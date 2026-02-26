use futures::stream::TryStreamExt;
use mongodb::Database;
use mongodb::bson::doc;
use rocket::{State, http::Status, serde::json::Json};

use crate::models::{ApiResponse, Category};

/// List all categories
#[utoipa::path(
    get,
    path = "/api/categories",
    responses(
        (status = 200, description = "成功获取分类列表", body = ApiResponse<Vec<Category>>),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "分类管理"
)]
#[get("/categories")]
pub async fn list_categories(
    db: &State<Database>,
) -> Result<Json<ApiResponse<Vec<Category>>>, Status> {
    let collection = db.collection::<Category>("categories");

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    let mut cursor = collection
        .find(doc! {})
        .with_options(find_options)
        .await
        .map_err(|_| Status::InternalServerError)?;

    let mut items = Vec::new();
    while let Some(category) = cursor
        .try_next()
        .await
        .map_err(|_| Status::InternalServerError)?
    {
        items.push(category);
    }

    Ok(Json(ApiResponse::success(items)))
}
