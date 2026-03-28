//! Site-related handlers (config, categories, recentlies)

use crate::models::common::PaginatedList;
use crate::models::options::SiteConfig;
use crate::services::options;
use crate::{
    app::SharedState,
    error::{AppQuery, AppResult},
    models::*,
};
use axum::{Json, extract::State};
use bson::doc;
use futures::stream::TryStreamExt;
use mongodb::Collection;

use super::pagination::PaginationParams;

/// Get public configuration
pub async fn get_config(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<SiteConfig>>> {
    let config = options::get_site_config(&state.db)
        .await
        .map_err(|e| crate::error::AppError::Internal(format!("Failed to fetch config: {}", e)))?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: config,
    }))
}

/// List all categories
pub async fn list_categories(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<Vec<Category>>>> {
    let collection: Collection<Category> = state.db.collection("categories");

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    let mut cursor = collection
        .find(doc! {})
        .with_options(find_options)
        .await
        .map_err(|e| {
            crate::error::AppError::Internal(format!("Failed to fetch categories: {}", e))
        })?;

    let mut items = Vec::new();
    while let Some(category) = cursor.try_next().await.map_err(|e| {
        crate::error::AppError::Internal(format!("Failed to iterate categories: {}", e))
    })? {
        items.push(category);
    }

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: items,
    }))
}

/// List recently published moments with pagination
pub async fn list_recentlies(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<PaginationParams>,
) -> AppResult<Json<ApiResponse<PaginatedList<Recently>>>> {
    let page = params.page.max(1);
    let size = params.size.clamp(1, 100);
    let skip = ((page - 1) * size).max(0) as u64;

    let collection: Collection<Recently> = state.db.collection("recentlies");

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip)
        .limit(size)
        .build();

    let total = collection.count_documents(doc! {}).await.map_err(|e| {
        crate::error::AppError::Internal(format!("Failed to count recentlies: {}", e))
    })?;

    let mut cursor = collection
        .find(doc! {})
        .with_options(find_options)
        .await
        .map_err(|e| {
            crate::error::AppError::Internal(format!("Failed to find recentlies: {}", e))
        })?;

    let mut items = Vec::new();
    while let Some(result) = cursor.try_next().await.map_err(|e| {
        crate::error::AppError::Internal(format!("Failed to iterate recentlies: {}", e))
    })? {
        items.push(result);
    }

    let pagination = Pagination::new(total as i64, page, size);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: PaginatedList { items, pagination },
    }))
}
