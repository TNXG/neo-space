//! Owner-only public API response cache maintenance.

use crate::{app::SharedState, auth::extractors::OwnerOnly, models::ApiResponse};
use axum::{Json, extract::State};

/// Clear only this process's public API response cache, not credentials or link-derived caches.
#[utoipa::path(
    delete,
    path = "/api/admin/cache",
    responses(
        (status = 200, description = "Current process public API response cache cleared; data is null", body = ApiResponse<serde_json::Value>),
        (status = 401, description = "Authentication required"),
        (status = 403, description = "Owner permission or valid CSRF origin/header required")
    ),
    tag = "admin"
)]
pub async fn clear_cache(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> Json<ApiResponse<()>> {
    state.response_cache.invalidate_all();
    Json(ApiResponse::success(()))
}
