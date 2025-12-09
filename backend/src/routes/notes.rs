use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use std::str::FromStr;

use crate::models::{Note, ApiResponse, PaginatedResponse, PaginatedData, Pagination};

/// List published notes with pagination
#[get("/notes?<page>&<size>")]
pub async fn list_notes(
    db: &State<Database>,
    page: Option<i64>,
    size: Option<i64>,
) -> Result<Json<PaginatedResponse<Note>>, Status> {
    let page = page.unwrap_or(1).max(1);
    let size = size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = db.collection::<Note>("notes");
    
    // Query only published notes, sorted by creation date (newest first)
    let filter = doc! { "isPublished": true };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    // Get total count
    let total = collection.count_documents(filter.clone()).await
        .map_err(|e| {
            eprintln!("Error counting documents: {:?}", e);
            Status::InternalServerError
        })?;

    // Fetch notes
    let mut cursor = collection.find(filter).with_options(find_options).await
        .map_err(|e| {
            eprintln!("Error finding documents: {:?}", e);
            Status::InternalServerError
        })?;

    let mut items = Vec::new();
    while let Some(note) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error deserializing note: {:?}", e);
        Status::InternalServerError
    })? {
        items.push(note);
    }

    let total_page = (total as f64 / size as f64).ceil() as i64;
    let pagination = Pagination {
        total: total as i64,
        current_page: page,
        total_page,
        size,
        has_next_page: page < total_page,
        has_prev_page: page > 1,
    };

    Ok(Json(ApiResponse::success(PaginatedData { items, pagination })))
}

/// Get note by ID
#[get("/notes/<id>")]
pub async fn get_note_by_id(
    db: &State<Database>,
    id: String,
) -> Result<Json<ApiResponse<Note>>, Status> {
    let object_id = ObjectId::from_str(&id).map_err(|_| Status::BadRequest)?;
    
    let collection = db.collection::<Note>("notes");
    let note = collection.find_one(doc! { "_id": object_id, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    Ok(Json(ApiResponse::success(note)))
}
