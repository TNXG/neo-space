//! Basic API metadata handler.

use crate::models::ApiResponse;
use axum::Json;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
}

pub async fn app_info() -> Json<ApiResponse<AppInfo>> {
    Json(ApiResponse::success(AppInfo {
        name: env!("CARGO_PKG_NAME"),
        version: env!("CARGO_PKG_VERSION"),
    }))
}
