//! Admin comment data adapter for local MongoDB shapes.

use std::collections::HashMap;

use crate::{
    error::{AppError, AppResult},
    handlers::admin::comments_anchor,
    models::*,
    services::comment::CommentService,
};
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

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdminCommentParentPreview {
    #[serde(rename = "_id")]
    pub id: String,
    pub author: Option<String>,
    pub text: String,
    pub is_deleted: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdminCommentAnchor {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub category_slug: Option<String>,
    pub nid: Option<i32>,
    pub path: String,
}

#[derive(Debug, Serialize, Clone)]
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
    pub parent: Option<AdminCommentParentPreview>,
    pub root_comment_id: Option<String>,
    pub reply_count: i32,
    pub latest_reply_at: Option<String>,
    pub is_deleted: bool,
    pub anchor: Option<AdminCommentAnchor>,
}

pub fn state_filter(state: i32) -> Document {
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

pub fn state_update_doc(state: i32) -> Document {
    doc! {
        "$set": {
            "state": state
        },
        "$unset": {
            "status": ""
        }
    }
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

pub(super) fn document_string(document: &Document, keys: &[&str]) -> Option<String> {
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

fn normalize_ref_type(document: &Document) -> String {
    match document
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
    }
}

fn admin_comment_from_document(document: Document) -> AdminCommentItem {
    AdminCommentItem {
        id: document_string(&document, &["_id"]).unwrap_or_default(),
        created_at: document_datetime(&document, &["created", "createdAt"]).unwrap_or_default(),
        r#ref: document_string(&document, &["ref", "refId"]).unwrap_or_default(),
        ref_type: normalize_ref_type(&document),
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
        parent: None,
        root_comment_id: document_string(&document, &["rootCommentId"]),
        reply_count: document.get_i32("replyCount").unwrap_or(0),
        latest_reply_at: document_datetime(&document, &["latestReplyAt"]),
        is_deleted: document.get_bool("isDeleted").unwrap_or(false),
        anchor: None,
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
        .map_err(|error| AppError::Database(error.to_string()))?;
    let options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1, "createdAt": -1 })
        .skip(skip)
        .limit(size as i64)
        .projection(comment_projection())
        .build();
    let mut cursor = collection
        .find(filter)
        .with_options(options)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut items = Vec::new();

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        items.push(admin_comment_from_document(document));
    }

    hydrate_parent_previews(db, &mut items).await?;
    comments_anchor::hydrate_anchors(db, &mut items).await?;

    Ok(PaginatedData {
        items,
        pagination: Pagination::new(total as i64, page as i64, size as i64),
    })
}

fn comment_projection() -> Document {
    doc! {
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
    }
}

async fn hydrate_parent_previews(db: &Database, items: &mut [AdminCommentItem]) -> AppResult<()> {
    let parent_ids = items
        .iter()
        .filter_map(|item| item.parent_comment_id.as_deref())
        .filter_map(|id| ObjectId::parse_str(id).ok())
        .collect::<Vec<_>>();

    if parent_ids.is_empty() {
        return Ok(());
    }

    let mut cursor = db
        .collection::<Document>("comments")
        .find(doc! { "_id": { "$in": parent_ids } })
        .projection(doc! { "_id": 1, "author": 1, "text": 1, "isDeleted": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut parent_map = HashMap::new();

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        let id = document_string(&document, &["_id"]).unwrap_or_default();
        parent_map.insert(
            id.clone(),
            AdminCommentParentPreview {
                id,
                author: document_string(&document, &["author"]),
                text: document.get_str("text").unwrap_or_default().to_string(),
                is_deleted: document.get_bool("isDeleted").unwrap_or(false),
            },
        );
    }

    for item in items {
        item.parent = item
            .parent_comment_id
            .as_ref()
            .and_then(|id| parent_map.get(id).cloned());
    }

    Ok(())
}
