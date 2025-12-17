
use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::doc;

use crate::models::{Page, ApiResponse};

/// Get page by slug
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
