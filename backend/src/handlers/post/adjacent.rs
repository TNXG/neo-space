//! Adjacent posts handler

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
use serde::{Deserialize, Serialize};

use super::enrich::fetch_category_by_id;

#[derive(Debug, Serialize)]
pub struct AdjacentPost {
    pub slug: String,
    pub title: String,
    #[serde(rename = "categorySlug")]
    pub category_slug: String,
}

#[derive(Debug, Serialize)]
pub struct AdjacentPosts {
    pub prev: Option<AdjacentPost>,
    pub next: Option<AdjacentPost>,
}

/// Minimal post structure for projection queries
#[derive(Debug, Serialize, Deserialize, Clone)]
struct MinimalPost {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub slug: String,
    pub title: String,
    #[serde(rename = "categoryId")]
    pub category_id: ObjectId,
    pub created: bson::DateTime,
}

/// Get adjacent posts (previous and next) by slug
pub async fn get_adjacent_posts(
    State(state): State<SharedState>,
    Path(slug): Path<String>,
) -> AppResult<Json<ApiResponse<AdjacentPosts>>> {
    let posts_collection = state.db.collection::<MinimalPost>("posts");

    // Get current post to find its creation date
    let current_post = posts_collection
        .find_one(doc! { "slug": &slug, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Post not found".to_string()))?;

    // Find previous and next posts
    let prev = find_adjacent_post(&state, &current_post, true).await?;
    let next = find_adjacent_post(&state, &current_post, false).await?;

    Ok(Json(ApiResponse::success(AdjacentPosts { prev, next })))
}

/// Find adjacent post (previous or next)
async fn find_adjacent_post(
    state: &SharedState,
    current_post: &MinimalPost,
    find_previous: bool,
) -> AppResult<Option<AdjacentPost>> {
    let posts_collection = state.db.collection::<MinimalPost>("posts");

    let filter = if find_previous {
        doc! {
            "created": { "$lt": current_post.created },
            "isPublished": true
        }
    } else {
        doc! {
            "created": { "$gt": current_post.created },
            "isPublished": true
        }
    };

    let sort_order = if find_previous { -1 } else { 1 };
    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": sort_order })
        .build();

    let adjacent_post = posts_collection
        .find_one(filter)
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    match adjacent_post {
        Some(post) => {
            let category = fetch_category_by_id(state, post.category_id).await?;
            if let Some(cat) = category {
                Ok(Some(AdjacentPost {
                    slug: post.slug,
                    title: post.title,
                    category_slug: cat.slug,
                }))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}
