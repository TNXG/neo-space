use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::doc;
use futures::stream::TryStreamExt;

use crate::models::{Activity, ApiResponse};

/// List recent activities
#[get("/activities?<limit>")]
pub async fn list_activities(
    db: &State<Database>,
    limit: Option<i64>,
) -> Result<Json<ApiResponse<Vec<Activity>>>, Status> {
    let limit = limit.unwrap_or(10).clamp(1, 100);

    let collection = db.collection::<Activity>("activities");
    
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .limit(limit)
        .build();

    let mut cursor = collection.find(doc! {}).with_options(find_options).await
        .map_err(|_| Status::InternalServerError)?;

    let mut items = Vec::new();
    while let Some(activity) = cursor.try_next().await.map_err(|_| Status::InternalServerError)? {
        items.push(activity);
    }

    Ok(Json(ApiResponse::success(items)))
}
