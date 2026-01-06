//! 删除评论路由

use mongodb::bson::doc;
use rocket::serde::json::Json;
use rocket::{State, http::Status, delete};

use crate::models::{ApiResponse, Comment};
use crate::utils::db::parse_object_id;

/**
 * DELETE /api/comments/<id>
 * 删除评论
 */
#[delete("/<id>")]
pub async fn delete_comment(
    db: &State<mongodb::Database>,
    id: String,
) -> Result<Json<ApiResponse<()>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = parse_object_id(&id)?;

    match collection.delete_one(doc! { "_id": oid }).await {
        Ok(_) => Ok(Json(ApiResponse::success_with_message(
            (),
            "Comment deleted successfully".to_string(),
        ))),
        Err(e) => {
            eprintln!("Failed to delete comment: {e}");
            Err(Status::InternalServerError)
        }
    }
}