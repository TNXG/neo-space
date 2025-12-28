
use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::doc;

use crate::models::{Page, ApiResponse};

/// Get page by slug
#[utoipa::path(
    get,
    path = "/api/pages/{slug}",
    params(
        ("slug" = String, Path, description = "页面URL别名")
    ),
    responses(
        (status = 200, description = "成功获取页面详情", body = ApiResponse<Page>),
        (status = 404, description = "页面不存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "页面管理"
)]
#[get("/pages/<slug>")]
pub async fn get_page_by_slug(
    db: &State<Database>,
    slug: &str,
) -> Result<Json<ApiResponse<Page>>, Status> {
    let collection = db.collection::<Page>("pages");
    let page = collection.find_one(doc! { "slug": slug }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    Ok(Json(ApiResponse::success(page)))
}
