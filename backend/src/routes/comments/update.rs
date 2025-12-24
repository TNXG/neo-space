//! 更新评论路由

use mongodb::bson::{doc, oid::ObjectId};
use rocket::serde::json::Json;
use rocket::{State, http::Status, put};
use std::str::FromStr;

use crate::models::{ApiResponse, Comment, UpdateCommentRequest};

/**
 * PUT /api/comments/<id>
 * 更新评论
 */
#[put("/<id>", data = "<request>")]
pub async fn update_comment(
    db: &State<mongodb::Database>,
    id: String,
    request: Json<UpdateCommentRequest>,
) -> Result<Json<ApiResponse<Comment>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    let update = doc! {
        "$set": {
            "text": &request.text,
        }
    };

    match collection.update_one(doc! { "_id": oid }, update).await {
        Ok(_) => {
            // 获取更新后的评论
            match collection.find_one(doc! { "_id": oid }).await {
                Ok(Some(comment)) => Ok(Json(ApiResponse::success_with_message(
                    comment,
                    "Comment updated successfully".to_string(),
                ))),
                _ => Err(Status::InternalServerError),
            }
        }
        Err(e) => {
            eprintln!("Failed to update comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}