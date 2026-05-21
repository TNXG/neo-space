//! Page handlers

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::doc;

/// Get page by slug
pub async fn get_page_by_slug(
    State(state): State<SharedState>,
    Path(slug): Path<String>,
) -> AppResult<Json<ApiResponse<Page>>> {
    let collection = state.db.collection::<Page>("pages");
    let page = collection
        .find_one(doc! { "slug": &slug })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Page not found".to_string()))?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: page,
    }))
}
