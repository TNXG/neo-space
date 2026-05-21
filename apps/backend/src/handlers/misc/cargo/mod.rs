mod index;
mod resolver;
mod tree;
mod types;
mod utils;

use axum::{
    Json,
    extract::{Path, State},
};

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::ApiResponse,
};

use resolver::resolve_crate;
pub use types::CrateInfo;

pub async fn get_crate_info(
    State(state): State<SharedState>,
    Path(name): Path<String>,
) -> AppResult<Json<ApiResponse<CrateInfo>>> {
    get_crate_info_inner(state, name, None).await
}

pub async fn get_crate_info_with_version(
    State(state): State<SharedState>,
    Path((name, version)): Path<(String, String)>,
) -> AppResult<Json<ApiResponse<CrateInfo>>> {
    get_crate_info_inner(state, name, Some(version)).await
}

async fn get_crate_info_inner(
    state: SharedState,
    name: String,
    version: Option<String>,
) -> AppResult<Json<ApiResponse<CrateInfo>>> {
    if !utils::is_valid_crate_name(&name) {
        return Err(AppError::BadRequest("Invalid crate name".to_string()));
    }

    let cache_key = utils::build_crate_cache_key(&name, version.as_deref());

    if let Some(cached) = state.cache.get(&cache_key).await {
        let data: CrateInfo = serde_json::from_slice(&cached).map_err(|error| {
            AppError::Internal(format!("Failed to decode cargo cache: {error}"))
        })?;

        return Ok(Json(ApiResponse::success(data)));
    }

    let data = resolve_crate(&state, &name, version.as_deref())
        .await?
        .ok_or_else(|| AppError::NotFound("Crate or version not found".to_string()))?;

    if let Ok(serialized) = serde_json::to_vec(&data) {
        state.cache.insert(cache_key, serialized).await;
    }

    Ok(Json(ApiResponse::success(data)))
}
