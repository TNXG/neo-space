use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

use crate::models::{Category, ApiResponse};

/// List all categories
#[get("/categories")]
pub async fn list_categories(
    db: &State<Database>,
) -> Result<Json<ApiResponse<Vec<Category>>>, Status> {
    let collection = db.collection::<Category>("categories");
    
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    let mut cursor = collection.find(doc! {}).with_options(find_options).await
        .map_err(|_| Status::InternalServerError)?;

    let mut items = Vec::new();
    while let Some(category) = cursor.try_next().await.map_err(|_| Status::InternalServerError)? {
        items.push(category);
    }

    Ok(Json(ApiResponse::success(items)))
}
