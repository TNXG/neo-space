//! 实体与字典翻译词条管理接口。

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::{ApiResponse, Pagination, TranslationEntry},
};

#[derive(Debug, Deserialize)]
pub struct EntryListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    #[serde(rename = "keyPath")]
    pub key_path: Option<String>,
    pub lang: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct EntryListResponse {
    pub items: Vec<TranslationEntry>,
    pub pagination: Pagination,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEntryRequest {
    #[serde(rename = "translatedText")]
    pub translated_text: String,
}

pub async fn list_entries(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(query): AppQuery<EntryListQuery>,
) -> AppResult<Json<ApiResponse<EntryListResponse>>> {
    let page = query.page.unwrap_or(1).max(1);
    let size = query.size.unwrap_or(20).clamp(1, 100);
    let mut filter = doc! {};
    if let Some(key_path) = query.key_path.filter(|value| !value.is_empty()) {
        filter.insert("keyPath", key_path);
    }
    if let Some(lang) = query.lang.filter(|value| !value.is_empty()) {
        filter.insert("lang", lang);
    }

    let collection = state
        .db
        .collection::<TranslationEntry>("translation_entries");
    let total = collection
        .count_documents(filter.clone())
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut cursor = collection
        .find(filter)
        .sort(doc! { "created": -1 })
        .skip((page - 1) * size)
        .limit(size as i64)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut items = Vec::new();
    while let Some(entry) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        items.push(entry);
    }

    Ok(Json(ApiResponse::success(EntryListResponse {
        items,
        pagination: Pagination::new(total as i64, page as i64, size as i64),
    })))
}

pub async fn update_entry(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(request): AppJson<UpdateEntryRequest>,
) -> AppResult<Json<ApiResponse<TranslationEntry>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))?;
    let translated_text = request.translated_text.trim();
    if translated_text.is_empty() {
        return Err(AppError::BadRequest(
            "translatedText cannot be empty".to_string(),
        ));
    }

    let collection = state
        .db
        .collection::<TranslationEntry>("translation_entries");
    collection
        .update_one(
            doc! { "_id": object_id },
            doc! { "$set": { "translatedText": translated_text } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let entry = collection
        .find_one(doc! { "_id": object_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("Translation entry not found".to_string()))?;
    Ok(Json(ApiResponse::success(entry)))
}

pub async fn delete_entry(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))?;
    let result = state
        .db
        .collection::<TranslationEntry>("translation_entries")
        .delete_one(doc! { "_id": object_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound(
            "Translation entry not found".to_string(),
        ));
    }
    Ok(Json(ApiResponse::success(())))
}
