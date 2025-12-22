//! 管理员评论操作路由

use mongodb::bson::{doc, oid::ObjectId};
use rocket::serde::json::Json;
use rocket::{State, http::Status, patch, delete};
use std::str::FromStr;

use crate::models::{ApiResponse, Comment, ResponseStatus};
use crate::guards::OwnerGuard;

/**
 * PATCH /api/comments/<id>/hide
 * 隐藏评论（仅管理员）- 使用 is_whispers 字段
 */
#[patch("/<id>/hide")]
pub async fn hide_comment(
    db: &State<mongodb::Database>,
    _owner: OwnerGuard,
    id: String,
) -> Result<Json<ApiResponse<()>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    let update = doc! {
        "$set": {
            "isWhispers": true,
        }
    };

    match collection.update_one(doc! { "_id": oid }, update).await {
        Ok(_) => Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "Comment hidden successfully".to_string(),
            data: (),
        })),
        Err(e) => {
            eprintln!("Failed to hide comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}

/**
 * DELETE /api/comments/<id>/hide
 * 取消隐藏评论（仅管理员）- 使用 is_whispers 字段
 */
#[delete("/<id>/hide")]
pub async fn unhide_comment(
    db: &State<mongodb::Database>,
    _owner: OwnerGuard,
    id: String,
) -> Result<Json<ApiResponse<()>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    let update = doc! {
        "$set": {
            "isWhispers": false,
        }
    };

    match collection.update_one(doc! { "_id": oid }, update).await {
        Ok(_) => Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "Comment unhidden successfully".to_string(),
            data: (),
        })),
        Err(e) => {
            eprintln!("Failed to unhide comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}

/**
 * PATCH /api/comments/<id>/pin
 * 置顶评论（仅管理员）
 */
#[patch("/<id>/pin")]
pub async fn pin_comment(
    db: &State<mongodb::Database>,
    _owner: OwnerGuard,
    id: String,
) -> Result<Json<ApiResponse<()>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    let update = doc! {
        "$set": {
            "pin": true,
        }
    };

    match collection.update_one(doc! { "_id": oid }, update).await {
        Ok(_) => Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "Comment pinned successfully".to_string(),
            data: (),
        })),
        Err(e) => {
            eprintln!("Failed to pin comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}

/**
 * DELETE /api/comments/<id>/pin
 * 取消置顶评论（仅管理员）
 */
#[delete("/<id>/pin")]
pub async fn unpin_comment(
    db: &State<mongodb::Database>,
    _owner: OwnerGuard,
    id: String,
) -> Result<Json<ApiResponse<()>>, Status> {
    let collection = db.collection::<Comment>("comments");

    let oid = match ObjectId::from_str(&id) {
        Ok(oid) => oid,
        Err(_) => return Err(Status::BadRequest),
    };

    let update = doc! {
        "$set": {
            "pin": false,
        }
    };

    match collection.update_one(doc! { "_id": oid }, update).await {
        Ok(_) => Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: "Comment unpinned successfully".to_string(),
            data: (),
        })),
        Err(e) => {
            eprintln!("Failed to unpin comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}