//! Post detail handlers (by ID and slug)

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};

use super::enrich::enrich_single_post;

/// Get a post by ID
pub async fn get_post(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<PostWithCategory>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let posts_collection = state.db.collection::<Post>("posts");
    let post = posts_collection
        .find_one(doc! { "_id": object_id, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Post not found".to_string()))?;

    let enriched = enrich_single_post(&state, post, &id).await?;
    Ok(Json(ApiResponse::success(enriched)))
}

/// Get a post by slug
pub async fn get_post_by_slug(
    State(state): State<SharedState>,
    Path(slug): Path<String>,
) -> AppResult<Json<ApiResponse<PostWithCategory>>> {
    let posts_collection = state.db.collection::<Post>("posts");

    let post = posts_collection
        .find_one(doc! { "slug": &slug, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Post not found".to_string()))?;

    let post_id = post.id.to_hex();
    let enriched = enrich_single_post(&state, post, &post_id).await?;
    Ok(Json(ApiResponse::success(enriched)))
}
