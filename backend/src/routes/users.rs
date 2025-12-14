use rocket::serde::json::Json;
use rocket::{get, State};
use mongodb::Database;
use crate::models::{ApiResponse, User, Reader};
use crate::db;

/// Get user profile (non-sensitive data)
#[get("/user/profile")]
pub async fn get_user_profile(database: &State<Database>) -> Json<ApiResponse<User>> {
    match db::get_user_profile(database).await {
        Ok(user) => Json(ApiResponse::success(user)),
        Err(e) => Json(ApiResponse {
            code: 500,
            status: crate::models::ResponseStatus::Failed,
            message: format!("Failed to fetch user profile: {}", e),
            data: User::default(),
        }),
    }
}

/// Get all readers (non-sensitive data)
#[get("/readers")]
pub async fn list_readers(database: &State<Database>) -> Json<ApiResponse<Vec<Reader>>> {
    match db::get_all_readers(database).await {
        Ok(readers) => Json(ApiResponse::success(readers)),
        Err(e) => Json(ApiResponse {
            code: 500,
            status: crate::models::ResponseStatus::Failed,
            message: format!("Failed to fetch readers: {}", e),
            data: vec![],
        }),
    }
}

/// Get reader by ID (non-sensitive data)
#[get("/readers/<id>")]
pub async fn get_reader_by_id(id: String, database: &State<Database>) -> Json<ApiResponse<Reader>> {
    match db::get_reader_by_id(database, &id).await {
        Ok(Some(reader)) => Json(ApiResponse::success(reader)),
        Ok(None) => Json(ApiResponse {
            code: 404,
            status: crate::models::ResponseStatus::Failed,
            message: "Reader not found".to_string(),
            data: Reader::default(),
        }),
        Err(e) => Json(ApiResponse {
            code: 500,
            status: crate::models::ResponseStatus::Failed,
            message: format!("Failed to fetch reader: {}", e),
            data: Reader::default(),
        }),
    }
}