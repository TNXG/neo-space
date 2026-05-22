//! Admin says / recently（owner-only CRUD）
//!
//! - 说说（Say）：完整 CRUD
//! - 速记（Recently）：CRUD + 全部清空

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
pub struct PageQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
}

// ==================== Say ====================

#[derive(Debug, Deserialize)]
pub struct CreateSayRequest {
    pub text: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateSayRequest {
    pub text: Option<String>,
    pub source: Option<String>,
    pub author: Option<String>,
}

pub async fn list_says(
    State(state): State<SharedState>,
    AppQuery(q): AppQuery<PageQuery>,
) -> AppResult<Json<ApiResponse<PaginatedData<Say>>>> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 100);
    let skip = (page - 1) * size;
    let collection = state.db.collection::<Say>("says");
    let total = collection
        .count_documents(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip)
        .limit(size as i64)
        .build();
    let mut cursor = collection
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(s) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(s);
    }
    let pagination = Pagination::new(total as i64, page as i64, size as i64);
    Ok(Json(ApiResponse::success(PaginatedData {
        items,
        pagination,
    })))
}

pub async fn create_say(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateSayRequest>,
) -> AppResult<Json<ApiResponse<Say>>> {
    let id = ObjectId::new();
    let mut doc = doc! {
        "_id": id,
        "text": &req.text,
        "created": bson::DateTime::now(),
    };
    if let Some(v) = &req.source {
        doc.insert("source", v);
    }
    if let Some(v) = &req.author {
        doc.insert("author", v);
    }
    state
        .db
        .collection::<bson::Document>("says")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let inserted = state
        .db
        .collection::<Say>("says")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Say not found after insert".into()))?;
    Ok(Json(ApiResponse::success(inserted)))
}

pub async fn update_say(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdateSayRequest>,
) -> AppResult<Json<ApiResponse<Say>>> {
    let oid = parse_oid(&id)?;
    let mut set_doc = doc! { "modified": bson::DateTime::now() };
    if let Some(v) = req.text {
        set_doc.insert("text", v);
    }
    if let Some(v) = req.source {
        set_doc.insert("source", v);
    }
    if let Some(v) = req.author {
        set_doc.insert("author", v);
    }
    let collection = state.db.collection::<Say>("says");
    let result = collection
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.matched_count == 0 {
        return Err(AppError::NotFound("Say not found".into()));
    }
    let updated = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Say not found".into()))?;
    Ok(Json(ApiResponse::success(updated)))
}

pub async fn delete_say(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let result = state
        .db
        .collection::<Say>("says")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Say not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

// ==================== Recently ====================

#[derive(Debug, Deserialize)]
pub struct CreateRecentlyRequest {
    pub content: String,
}

pub async fn create_recently(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateRecentlyRequest>,
) -> AppResult<Json<ApiResponse<Recently>>> {
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "content": &req.content,
        "up": 0,
        "down": 0,
        "created": bson::DateTime::now(),
    };
    state
        .db
        .collection::<bson::Document>("recentlies")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let inserted = state
        .db
        .collection::<Recently>("recentlies")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Recently not found after insert".into()))?;
    Ok(Json(ApiResponse::success(inserted)))
}

pub async fn update_recently(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<CreateRecentlyRequest>,
) -> AppResult<Json<ApiResponse<Recently>>> {
    let oid = parse_oid(&id)?;
    let collection = state.db.collection::<Recently>("recentlies");
    let result = collection
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "content": &req.content } },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.matched_count == 0 {
        return Err(AppError::NotFound("Recently not found".into()));
    }
    let updated = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Recently not found".into()))?;
    Ok(Json(ApiResponse::success(updated)))
}

pub async fn delete_recently(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let result = state
        .db
        .collection::<Recently>("recentlies")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Recently not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

pub async fn clear_recently(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<u64>>> {
    let result = state
        .db
        .collection::<Recently>("recentlies")
        .delete_many(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(result.deleted_count)))
}

pub async fn list_recently_all(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<Vec<Recently>>>> {
    let collection = state.db.collection::<Recently>("recentlies");
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    let mut cursor = collection
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(r) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(r);
    }
    Ok(Json(ApiResponse::success(items)))
}
