//! Site configuration routes

use mongodb::Database;
use rocket::serde::json::Json;
use rocket::{get, State};
use crate::models::{ApiResponse, SiteConfig};
use crate::services;

/// Get site configuration (safe for frontend)
#[get("/config")]
pub async fn get_site_config(database: &State<Database>) -> Json<ApiResponse<SiteConfig>> {
    match services::get_site_config(database).await {
        Ok(config) => Json(ApiResponse::success(config)),
        Err(e) => ApiResponse::json_error_with_default(500, format!("Failed to fetch site config: {}", e)),
    }
}
