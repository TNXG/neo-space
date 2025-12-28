use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

use crate::models::{Recently, ApiResponse, PaginatedResponse, PaginatedData, Pagination};

/// List recentlies with pagination
#[utoipa::path(
    get,
    path = "/api/recentlies",
    params(
        ("page" = Option<i64>, Query, description = "页码，默认为1"),
        ("size" = Option<i64>, Query, description = "每页大小，默认为10，最大100")
    ),
    responses(
        (status = 200, description = "成功获取动态列表", body = PaginatedResponse<Recently>),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "动态管理"
)]
#[get("/recentlies?<page>&<size>")]
pub async fn list_recentlies(
    db: &State<Database>,
    page: Option<i64>,
    size: Option<i64>,
) -> Result<Json<PaginatedResponse<Recently>>, Status> {
    let page = page.unwrap_or(1).max(1);
    let size = size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = db.collection::<Recently>("recentlies");
    
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    // Get total count
    let total = collection.count_documents(doc! {}).await
        .map_err(|e| {
            eprintln!("Error counting recentlies: {:?}", e);
            Status::InternalServerError
        })?;

    // Fetch items
    let mut cursor = collection.find(doc! {}).with_options(find_options).await
        .map_err(|e| {
            eprintln!("Error finding recentlies: {:?}", e);
            Status::InternalServerError
        })?;

    let mut items = Vec::new();
    while let Some(result) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error iterating recentlies cursor: {:?}", e);
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
