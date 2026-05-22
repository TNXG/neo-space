use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::Deserialize;

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

#[derive(Debug, Deserialize)]
pub struct DraftQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    #[serde(rename = "refType")]
    pub ref_type: Option<String>,
    #[serde(rename = "hasRef")]
    pub has_ref: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDraftRequest {
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(rename = "refId")]
    pub ref_id: Option<String>,
    pub title: Option<String>,
    pub text: Option<String>,
    #[serde(rename = "contentFormat")]
    pub content_format: Option<String>,
    pub content: Option<String>,
    pub images: Option<Vec<bson::Bson>>,
    pub meta: Option<bson::Bson>,
    #[serde(rename = "typeSpecificData")]
    pub type_specific_data: Option<bson::Bson>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateDraftRequest {
    pub title: Option<String>,
    pub text: Option<String>,
    #[serde(rename = "contentFormat")]
    pub content_format: Option<String>,
    pub content: Option<String>,
    pub images: Option<Vec<bson::Bson>>,
    pub meta: Option<bson::Bson>,
    #[serde(rename = "typeSpecificData")]
    pub type_specific_data: Option<bson::Bson>,
    #[serde(rename = "refId")]
    pub ref_id: Option<String>,
}

fn draft_saved_at(draft: &Draft) -> bson::DateTime {
    draft.updated.or(draft.modified).unwrap_or(draft.created)
}

fn draft_snapshot(draft: &Draft) -> bson::Document {
    let mut snapshot = doc! {
        "version": draft.version.max(1),
        "title": draft.title.clone().unwrap_or_default(),
        "text": draft.text.clone().unwrap_or_default(),
        "contentFormat": draft
            .content_format
            .clone()
            .unwrap_or_else(|| "markdown".to_string()),
        "savedAt": draft_saved_at(draft),
        "isFullSnapshot": true,
    };

    if let Some(content) = draft.content.clone() {
        snapshot.insert("content", content);
    }
    if let Some(type_specific_data) = draft.type_specific_data.clone() {
        snapshot.insert("typeSpecificData", type_specific_data);
    }

    snapshot
}

pub async fn list_drafts(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(q): AppQuery<DraftQuery>,
) -> AppResult<Json<ApiResponse<PaginatedData<Draft>>>> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 100);

    let mut filter = doc! {};
    if let Some(rt) = &q.ref_type {
        filter.insert("refType", rt);
    }
    if let Some(true) = q.has_ref {
        filter.insert("refId", doc! { "$ne": null });
    }
    if let Some(false) = q.has_ref {
        filter.insert("refId", doc! { "$eq": null });
    }

    let collection = state.db.collection::<Draft>("drafts");
    let total = collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip((page - 1) * size)
        .limit(size as i64)
        .build();
    let mut cursor = collection
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(d);
    }
    let pagination = Pagination::new(total as i64, page as i64, size as i64);
    Ok(Json(ApiResponse::success(PaginatedData {
        items,
        pagination,
    })))
}

pub async fn get_draft(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<Draft>>> {
    let oid = parse_oid(&id)?;
    let d = state
        .db
        .collection::<Draft>("drafts")
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Draft not found".into()))?;
    Ok(Json(ApiResponse::success(d)))
}

pub async fn get_draft_by_ref(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path((ref_type, ref_id)): Path<(String, String)>,
) -> AppResult<Json<ApiResponse<Option<Draft>>>> {
    let oid = parse_oid(&ref_id)?;
    let d = state
        .db
        .collection::<Draft>("drafts")
        .find_one(doc! { "refType": &ref_type, "refId": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(d)))
}

pub async fn get_new_drafts(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(ref_type): Path<String>,
) -> AppResult<Json<ApiResponse<Vec<Draft>>>> {
    let collection = state.db.collection::<Draft>("drafts");
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "updated": -1, "created": -1 })
        .build();
    let mut cursor = collection
        .find(doc! {
            "refType": &ref_type,
            "$or": [
                { "refId": { "$exists": false } },
                { "refId": null }
            ],
            "isPublished": { "$ne": true },
        })
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(draft) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(draft);
    }

    Ok(Json(ApiResponse::success(items)))
}

pub async fn create_draft(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateDraftRequest>,
) -> AppResult<Json<ApiResponse<Draft>>> {
    let id = ObjectId::new();
    let now = bson::DateTime::now();
    let mut doc = doc! {
        "_id": id,
        "refType": &req.ref_type,
        "title": req.title.unwrap_or_default(),
        "text": req.text.unwrap_or_default(),
        "contentFormat": req.content_format.unwrap_or_else(|| "markdown".into()),
        "version": 1,
        "history": [],
        "isPublished": false,
        "created": now,
        "updated": now,
    };
    if let Some(rid) = &req.ref_id {
        doc.insert("refId", parse_oid(rid)?);
    }
    if let Some(c) = req.content {
        doc.insert("content", c);
    }
    if let Some(images) = req.images {
        doc.insert("images", images);
    }
    if let Some(meta) = req.meta {
        doc.insert("meta", meta);
    }
    if let Some(tsd) = req.type_specific_data {
        doc.insert("typeSpecificData", tsd);
    }
    state
        .db
        .collection::<bson::Document>("drafts")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let d = state
        .db
        .collection::<Draft>("drafts")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Draft not found after insert".into()))?;
    Ok(Json(ApiResponse::success(d)))
}

pub async fn update_draft(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdateDraftRequest>,
) -> AppResult<Json<ApiResponse<Draft>>> {
    let oid = parse_oid(&id)?;
    let collection = state.db.collection::<Draft>("drafts");
    let current = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Draft not found".into()))?;
    let now = bson::DateTime::now();
    let mut set_doc = doc! {
        "updated": now,
        "modified": now,
        "version": current.version.max(1) + 1,
    };
    if let Some(v) = req.title {
        set_doc.insert("title", v);
    }
    if let Some(v) = req.text {
        set_doc.insert("text", v);
    }
    if let Some(v) = req.content_format {
        set_doc.insert("contentFormat", v);
    }
    if let Some(v) = req.content {
        set_doc.insert("content", v);
    }
    if let Some(images) = req.images {
        set_doc.insert("images", images);
    }
    if let Some(meta) = req.meta {
        set_doc.insert("meta", meta);
    }
    if let Some(tsd) = req.type_specific_data {
        set_doc.insert("typeSpecificData", tsd);
    }
    if let Some(r) = req.ref_id {
        set_doc.insert("refId", parse_oid(&r)?);
    }
    let result = collection
        .update_one(
            doc! { "_id": oid },
            doc! {
                "$set": set_doc,
                "$push": { "history": draft_snapshot(&current) },
            },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.matched_count == 0 {
        return Err(AppError::NotFound("Draft not found".into()));
    }
    let d = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Draft not found".into()))?;
    Ok(Json(ApiResponse::success(d)))
}

pub async fn delete_draft(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let r = state
        .db
        .collection::<Draft>("drafts")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if r.deleted_count == 0 {
        return Err(AppError::NotFound("Draft not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

pub async fn publish_draft(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    state
        .db
        .collection::<Draft>("drafts")
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "isPublished": true, "updated": bson::DateTime::now(), "modified": bson::DateTime::now() } },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}
