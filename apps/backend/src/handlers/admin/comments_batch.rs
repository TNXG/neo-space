//! Admin comments 批量操作

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::*,
    services::comment::CommentService,
};
use axum::{extract::State, response::Json};
use bson::{Bson, Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::Database;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ListCommentsAdminQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub state: Option<i32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminCommentItem {
    #[serde(rename = "_id")]
    pub id: String,
    pub created_at: String,
    pub r#ref: String,
    pub ref_type: String,
    pub state: i32,
    pub author: String,
    pub text: String,
    pub mail: Option<String>,
    pub url: Option<String>,
    pub ip: Option<String>,
    pub agent: Option<String>,
    pub pin: bool,
    pub avatar: Option<String>,
    pub is_whispers: bool,
    pub parent_comment_id: Option<String>,
    pub root_comment_id: Option<String>,
    pub reply_count: i32,
    pub latest_reply_at: Option<String>,
    pub is_deleted: bool,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum BatchStatePayload {
    Specific {
        ids: Vec<String>,
        state: i32,
    },
    All {
        // Wire-format discriminator — enforces matching the `all=true` JSON shape
        // even though we don't read the value after deserialization.
        #[allow(dead_code)]
        all: bool,
        state: i32,
        #[serde(rename = "currentState")]
        current_state: i32,
    },
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum BatchDeleteRequest {
    Specific {
        ids: Vec<String>,
    },
    All {
        #[allow(dead_code)]
        all: bool,
        state: i32,
    },
}

fn bson_to_string(value: Option<&Bson>) -> Option<String> {
    match value {
        Some(Bson::ObjectId(id)) => Some(id.to_hex()),
        Some(Bson::String(value)) if !value.trim().is_empty() => Some(value.clone()),
        Some(Bson::Int32(value)) => Some(value.to_string()),
        Some(Bson::Int64(value)) => Some(value.to_string()),
        Some(Bson::Double(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn document_string(document: &Document, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| bson_to_string(document.get(*key)))
}

fn document_datetime(document: &Document, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        document
            .get_datetime(key)
            .ok()
            .map(|value| value.to_chrono().to_rfc3339())
            .or_else(|| document.get_str(key).ok().map(ToOwned::to_owned))
    })
}

fn effective_state(document: &Document) -> i32 {
    match document.get_str("status").ok() {
        Some("approved") | Some("read") => CommentState::READ,
        Some("pending") => CommentState::PENDING,
        Some("spam") | Some("rejected") => CommentState::SPAM,
        _ => document.get_i32("state").unwrap_or(CommentState::UNREAD),
    }
}

fn state_filter(state: i32) -> Document {
    match state {
        CommentState::READ => doc! {
            "$or": [
                { "state": CommentState::READ },
                { "status": { "$in": ["approved", "read"] } }
            ]
        },
        CommentState::SPAM => doc! {
            "$or": [
                { "state": CommentState::SPAM },
                { "status": { "$in": ["spam", "rejected"] } }
            ]
        },
        CommentState::PENDING => doc! {
            "$or": [
                { "state": CommentState::PENDING },
                { "status": "pending" }
            ]
        },
        _ => doc! { "state": state },
    }
}

fn status_for_state(state: i32) -> Option<&'static str> {
    match state {
        CommentState::READ => Some("approved"),
        CommentState::SPAM => Some("spam"),
        CommentState::PENDING => Some("pending"),
        _ => None,
    }
}

fn state_update_doc(state: i32) -> Document {
    match status_for_state(state) {
        Some(status) => doc! {
            "$set": {
                "state": state,
                "status": status
            }
        },
        None => doc! {
            "$set": {
                "state": state
            }
        },
    }
}

fn admin_comment_from_document(document: Document) -> AdminCommentItem {
    let id = document_string(&document, &["_id"]).unwrap_or_default();
    let ref_type = match document
        .get_str("refType")
        .or_else(|_| document.get_str("ref_type"))
        .map(CommentService::normalize_ref_type)
        .unwrap_or_default()
        .as_str()
    {
        "posts" => "post".to_string(),
        "notes" => "note".to_string(),
        "pages" => "page".to_string(),
        value => value.to_string(),
    };

    AdminCommentItem {
        id,
        created_at: document_datetime(&document, &["created", "createdAt"]).unwrap_or_default(),
        r#ref: document_string(&document, &["ref", "refId"]).unwrap_or_default(),
        ref_type,
        state: effective_state(&document),
        author: document.get_str("author").unwrap_or_default().to_string(),
        text: document.get_str("text").unwrap_or_default().to_string(),
        mail: document_string(&document, &["mail", "email"]),
        url: document_string(&document, &["url"]),
        ip: document_string(&document, &["ip"]),
        agent: document_string(&document, &["agent", "userAgent"]),
        pin: document.get_bool("pin").unwrap_or(false),
        avatar: document_string(&document, &["avatar"]),
        is_whispers: document.get_bool("isWhispers").unwrap_or(false),
        parent_comment_id: document_string(&document, &["parentCommentId", "parent", "parentId"]),
        root_comment_id: document_string(&document, &["rootCommentId"]),
        reply_count: document.get_i32("replyCount").unwrap_or(0),
        latest_reply_at: document_datetime(&document, &["latestReplyAt"]),
        is_deleted: document.get_bool("isDeleted").unwrap_or(false),
    }
}

pub async fn list_comments_admin_data(
    db: &Database,
    query: ListCommentsAdminQuery,
) -> AppResult<PaginatedData<AdminCommentItem>> {
    let page = query.page.unwrap_or(1).max(1);
    let size = query.size.unwrap_or(20).clamp(1, 100);
    let skip = (page - 1) * size;
    let mut filter = doc! { "isDeleted": { "$ne": true } };

    if let Some(state) = query.state {
        filter = doc! {
            "$and": [
                filter,
                state_filter(state)
            ]
        };
    }

    let collection = db.collection::<Document>("comments");
    let total = collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip)
        .limit(size as i64)
        .projection(doc! {
            "_id": 1,
            "created": 1,
            "createdAt": 1,
            "ref": 1,
            "refId": 1,
            "refType": 1,
            "ref_type": 1,
            "state": 1,
            "status": 1,
            "author": 1,
            "text": 1,
            "mail": 1,
            "email": 1,
            "url": 1,
            "ip": 1,
            "agent": 1,
            "userAgent": 1,
            "pin": 1,
            "avatar": 1,
            "isWhispers": 1,
            "parentCommentId": 1,
            "parent": 1,
            "parentId": 1,
            "rootCommentId": 1,
            "replyCount": 1,
            "latestReplyAt": 1,
            "isDeleted": 1,
        })
        .build();
    let mut cursor = collection
        .find(filter)
        .with_options(options)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(admin_comment_from_document(document));
    }

    Ok(PaginatedData {
        items,
        pagination: Pagination::new(total as i64, page as i64, size as i64),
    })
}

pub async fn batch_update_state(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<BatchStatePayload>,
) -> AppResult<Json<ApiResponse<u64>>> {
    let collection = state.db.collection::<Comment>("comments");
    let (filter, new_state) = match payload {
        BatchStatePayload::Specific { ids, state: s } => {
            let mut oids = Vec::with_capacity(ids.len());
            for id in &ids {
                let oid = ObjectId::parse_str(id)
                    .map_err(|_| AppError::BadRequest(format!("Invalid id: {}", id)))?;
                oids.push(oid);
            }
            (doc! { "_id": { "$in": oids } }, s)
        }
        BatchStatePayload::All {
            all: _,
            state: s,
            current_state,
        } => (state_filter(current_state), s),
    };
    let result = collection
        .update_many(filter, state_update_doc(new_state))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(result.modified_count)))
}

pub async fn batch_delete(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<BatchDeleteRequest>,
) -> AppResult<Json<ApiResponse<u64>>> {
    let filter = match payload {
        BatchDeleteRequest::Specific { ids } => {
            let mut oids = Vec::with_capacity(ids.len());
            for id in &ids {
                oids.push(
                    ObjectId::parse_str(id)
                        .map_err(|_| AppError::BadRequest("Invalid id".into()))?,
                );
            }
            doc! { "_id": { "$in": oids } }
        }
        BatchDeleteRequest::All { all: _, state } => doc! {
            "$and": [
                { "isDeleted": { "$ne": true } },
                state_filter(state)
            ]
        },
    };
    let r = state
        .db
        .collection::<Comment>("comments")
        .update_many(filter, doc! { "$set": { "isDeleted": true } })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(r.modified_count)))
}

pub async fn update_state(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    axum::extract::Path(id): axum::extract::Path<String>,
    AppJson(payload): AppJson<serde_json::Value>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = ObjectId::parse_str(&id).map_err(|_| AppError::BadRequest("Invalid id".into()))?;
    let new_state = payload
        .get("state")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::BadRequest("state 必填".into()))?;
    state
        .db
        .collection::<Comment>("comments")
        .update_one(doc! { "_id": oid }, state_update_doc(new_state as i32))
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}
