//! Admin comment handlers (owner-only operations)

use crate::{
    app::SharedState,
    auth::extractors::{OptionalAuth, OwnerOnly},
    error::{AppError, AppJson, AppResult},
    models::*,
    services::comment::CommentService,
};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{doc, oid::ObjectId};

/// Update a comment
pub async fn update_comment(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    auth: OptionalAuth,
    AppJson(payload): AppJson<UpdateCommentRequest>,
) -> AppResult<Json<ApiResponse<CommentTree>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Comment>("comments");

    // Get existing comment
    let existing_comment = collection
        .find_one(doc! { "_id": object_id, "isDeleted": { "$ne": true } })
        .await
        .map_err(|e| AppError::Database(format!("Failed to find comment: {}", e)))?
        .ok_or(AppError::NotFound("Comment not found".to_string()))?;

    // Check ownership
    let can_edit = if auth.is_owner {
        true
    } else if let Some(user_id) = auth.user_id {
        // Check if user is the comment author
        let readers_collection = state.db.collection::<Reader>("readers");
        if let Ok(Some(reader)) = readers_collection.find_one(doc! { "_id": user_id }).await {
            reader.email == existing_comment.mail
        } else {
            false
        }
    } else {
        false
    };

    if !can_edit {
        return Err(AppError::Forbidden);
    }

    // Update comment text
    collection
        .update_one(
            doc! { "_id": object_id },
            doc! { "$set": { "text": &payload.text } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to update comment: {}", e)))?;

    // Get updated comment
    let updated_comment = collection
        .find_one(doc! { "_id": object_id, "isDeleted": { "$ne": true } })
        .await
        .map_err(|e| AppError::Database(format!("Failed to retrieve updated comment: {}", e)))?
        .ok_or(AppError::Internal("Updated comment not found".to_string()))?;

    let comment = CommentService::new(state.db.clone());
    let (email_to_avatar, email_to_is_owner, email_to_source) = comment
        .build_reader_mappings(vec![updated_comment.mail.clone()])
        .await;
    let comment_trees = comment.build_comment_tree(
        std::slice::from_ref(&updated_comment),
        &email_to_avatar,
        &email_to_is_owner,
        &email_to_source,
    );

    let comment_tree = comment_trees
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Internal("Failed to build comment tree".to_string()))?;

    tracing::info!("Comment {} updated", id);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Comment updated successfully".to_string(),
        data: comment_tree,
    }))
}

/// Delete a comment
pub async fn delete_comment(
    State(state): State<SharedState>,
    Path(id): Path<String>,
    auth: OptionalAuth,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Comment>("comments");

    // Get existing comment
    let _existing_comment = collection
        .find_one(doc! { "_id": object_id, "isDeleted": { "$ne": true } })
        .await
        .map_err(|e| AppError::Database(format!("Failed to find comment: {}", e)))?
        .ok_or(AppError::NotFound("Comment not found".to_string()))?;

    // Check ownership (only admin can delete)
    if !auth.is_owner {
        return Err(AppError::Forbidden);
    }

    // 旧评论结构采用软删除，保留数据供审计与后续恢复。
    let comment_service = CommentService::new(state.db.clone());
    let comment_ids = comment_service
        .collect_comment_subtree_ids(object_id)
        .await
        .map_err(|e| AppError::Database(format!("Failed to collect comment subtree: {}", e)))?;

    collection
        .update_many(
            doc! {
                "_id": { "$in": &comment_ids }
            },
            doc! {
                "$set": {
                    "isDeleted": true
                }
            },
        )
        .await
        .map_err(|e| {
            AppError::Database(format!("Failed to mark comment subtree as deleted: {}", e))
        })?;

    collection
        .update_many(
            doc! {
                "_id": { "$in": &comment_ids },
                "latestReplyAt": { "$exists": true }
            },
            doc! {
                "$set": {
                    "latestReplyAt": null
                }
            },
        )
        .await
        .map_err(|e| {
            AppError::Database(format!("Failed to clear deleted comment timestamps: {}", e))
        })?;

    tracing::info!("Comment {} and its children marked as deleted", id);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Comment deleted successfully".to_string(),
        data: (),
    }))
}

/// Hide a comment (owner only)
pub async fn hide_comment(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid comment ID".to_string()))?;

    let collection = state.db.collection::<Comment>("comments");
    let result = collection
        .update_one(
            doc! { "_id": object_id, "isDeleted": { "$ne": true } },
            doc! { "$set": { "isWhispers": true } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to hide comment: {}", e)))?;

    if result.matched_count == 0 {
        return Err(AppError::NotFound("Comment not found".to_string()));
    }

    Ok(Json(ApiResponse::success(())))
}

/// Unhide a comment (owner only)
pub async fn unhide_comment(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid comment ID".to_string()))?;

    let collection = state.db.collection::<Comment>("comments");
    let result = collection
        .update_one(
            doc! { "_id": object_id, "isDeleted": { "$ne": true } },
            doc! { "$set": { "isWhispers": false } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to unhide comment: {}", e)))?;

    if result.matched_count == 0 {
        return Err(AppError::NotFound("Comment not found".to_string()));
    }

    Ok(Json(ApiResponse::success(())))
}

/// Pin a comment (owner only)
pub async fn pin_comment(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid comment ID".to_string()))?;

    let collection = state.db.collection::<Comment>("comments");
    let result = collection
        .update_one(
            doc! { "_id": object_id, "isDeleted": { "$ne": true } },
            doc! { "$set": { "pin": true } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to pin comment: {}", e)))?;

    if result.matched_count == 0 {
        return Err(AppError::NotFound("Comment not found".to_string()));
    }

    Ok(Json(ApiResponse::success(())))
}

/// Unpin a comment (owner only)
pub async fn unpin_comment(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid comment ID".to_string()))?;

    let collection = state.db.collection::<Comment>("comments");
    let result = collection
        .update_one(
            doc! { "_id": object_id, "isDeleted": { "$ne": true } },
            doc! { "$set": { "pin": false } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to unpin comment: {}", e)))?;

    if result.matched_count == 0 {
        return Err(AppError::NotFound("Comment not found".to_string()));
    }

    Ok(Json(ApiResponse::success(())))
}
