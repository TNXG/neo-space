use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use std::str::FromStr;

use crate::models::{Post, ApiResponse, PaginatedResponse, PaginatedData, Pagination};

/// List published posts with pagination
#[get("/posts?<page>&<size>")]
pub async fn list_posts(
    db: &State<Database>,
    page: Option<i64>,
    size: Option<i64>,
) -> Result<Json<PaginatedResponse<Post>>, Status> {
    let page = page.unwrap_or(1).max(1);
    let size = size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = db.collection::<Post>("posts");
    
    // Query only published posts, sorted by creation date (newest first)
    let filter = doc! { "isPublished": true };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    // Get total count
    let total = collection.count_documents(filter.clone()).await
        .map_err(|e| {
            eprintln!("Error counting posts: {:?}", e);
            Status::InternalServerError
        })?;

    // Fetch posts
    let mut cursor = collection.find(filter).with_options(find_options).await
        .map_err(|e| {
            eprintln!("Error finding posts: {:?}", e);
            Status::InternalServerError
        })?;

    let mut items = Vec::new();
    while let Some(result) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error iterating posts cursor: {:?}", e);
        Status::InternalServerError
    })? {
        items.push(result);
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

/// Get post by ID
#[get("/posts/<id>")]
pub async fn get_post_by_id(
    db: &State<Database>,
    id: String,
) -> Result<Json<ApiResponse<Post>>, Status> {
    let object_id = ObjectId::from_str(&id).map_err(|_| Status::BadRequest)?;
    
    let collection = db.collection::<Post>("posts");
    let post = collection.find_one(doc! { "_id": object_id, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    Ok(Json(ApiResponse::success(post)))
}

/// Get post by slug
#[get("/posts/slug/<slug>")]
pub async fn get_post_by_slug(
    db: &State<Database>,
    slug: String,
) -> Result<Json<ApiResponse<Post>>, Status> {
    let collection = db.collection::<Post>("posts");
    let post = collection.find_one(doc! { "slug": slug, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    Ok(Json(ApiResponse::success(post)))
}
