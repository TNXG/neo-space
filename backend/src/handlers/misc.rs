//! Miscellaneous handlers

use crate::models::common::PaginatedList;
use crate::models::options::SiteConfig;
use crate::services::options;
use crate::{
    app::SharedState,
    error::{AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{Json, extract::State};
use bson::doc;
use futures::stream::TryStreamExt;
use mongodb::Collection;
use serde::{Deserialize, Serialize};

/// Pagination parameters
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_size")]
    pub size: i64,
}

fn default_page() -> i64 {
    1
}
fn default_size() -> i64 {
    10
}

/// NBNHHSH guess request
#[derive(Debug, Deserialize, Serialize)]
pub struct NbnhhshGuessRequest {
    pub text: String,
}

/// NBNHHSH guess result
#[derive(Debug, Deserialize, Serialize)]
pub struct NbnhhshGuessResult {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trans: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inputting: Option<Vec<String>>,
}

/// Get public configuration
/// Aggregates multiple option documents into a single SiteConfig (matches Rocket behavior)
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

    // Get total count
    let total = collection.count_documents(doc! {}).await.map_err(|e| {
        crate::error::AppError::Internal(format!("Failed to count recentlies: {}", e))
    })?;

    // Fetch items
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

/// Proxy endpoint for nbnhhsh guess API (Chinese pinyin guessing)
pub async fn nbnhhsh_guess(
    State(state): State<SharedState>,
    AppJson(request): AppJson<NbnhhshGuessRequest>,
) -> Json<Vec<NbnhhshGuessResult>> {
    let result = state
        .http_client
        .post("https://lab.magiconch.com/api/nbnhhsh/guess")
        .json(&serde_json::json!({ "text": request.text }))
        .send()
        .await;

    match result {
        Ok(response) => {
            if let Ok(data) = response.json::<Vec<NbnhhshGuessResult>>().await {
                Json(data)
            } else {
                Json(vec![])
            }
        }
        Err(_) => Json(vec![]),
    }
}
