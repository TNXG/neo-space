//! Site configuration routes

use mongodb::Database;
use rocket::serde::json::Json;
use rocket::{get, State};
use crate::models::{ApiResponse, SiteConfig};
use crate::services;

/// Get site configuration (safe for frontend)
#[utoipa::path(
    get,
    path = "/api/config",
    responses(
        (status = 200, description = "成功获取站点配置", body = ApiResponse<SiteConfig>),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "站点配置"
)]
#[get("/config")]
pub async fn get_site_config(database: &State<Database>) -> Json<ApiResponse<SiteConfig>> {
    match services::get_site_config(database).await {
        Ok(config) => Json(ApiResponse::success(config)),
        Err(e) => ApiResponse::json_error_with_default(500, format!("Failed to fetch site config: {e}")),
    }
}
