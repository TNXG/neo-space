//! 删除评论路由

use mongodb::bson::{doc, oid::ObjectId};
use rocket::serde::json::Json;
use rocket::{State, http::Status, delete};
use std::str::FromStr;

use crate::models::{ApiResponse, Comment};

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

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    match collection.delete_one(doc! { "_id": oid }).await {
        Ok(_) => Ok(Json(ApiResponse::success_with_message(
            (),
            "Comment deleted successfully".to_string(),
        ))),
        Err(e) => {
            eprintln!("Failed to delete comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}