use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

use crate::models::{Link, ApiResponse, PaginatedResponse, PaginatedData, Pagination};

/// List approved friend links with pagination
#[get("/links?<page>&<size>")]
pub async fn list_links(
    db: &State<Database>,
    page: Option<i64>,
    size: Option<i64>,
) -> Result<Json<PaginatedResponse<Link>>, Status> {
    let page = page.unwrap_or(1).max(1);
    let size = size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = db.collection::<Link>("links");
    
    let filter = doc! { };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    let total = collection.count_documents(filter.clone()).await
        .map_err(|_| Status::InternalServerError)?;

    let mut cursor = collection.find(filter).with_options(find_options).await
        .map_err(|_| Status::InternalServerError)?;

    let mut items = Vec::new();
    while let Some(link) = cursor.try_next().await.map_err(|_| Status::InternalServerError)? {
        items.push(link);
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
