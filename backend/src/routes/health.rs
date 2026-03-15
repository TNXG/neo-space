//! Health check routes

use crate::app::SharedState;

/// Create health check routes (with SharedState type for compatibility)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new().route("/health", axum::routing::get(health_check))
}

/// Simple health check endpoint
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Health check successful")
    ),
    tag = "health"
)]
pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
