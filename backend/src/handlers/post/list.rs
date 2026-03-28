//! Post list handler

use crate::{
    app::SharedState,
    error::{AppError, AppQuery, AppResult},
    models::*,
};
use axum::{extract::State, response::Json};
use bson::doc;
use futures::stream::TryStreamExt;
use serde::Deserialize;

use super::enrich::enrich_posts_with_data;

#[derive(Debug, Deserialize)]
pub struct ListPostsParams {
    page: Option<u64>,
    size: Option<u64>,
    category: Option<String>,
}

/// List published posts with pagination
pub async fn list_posts(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<ListPostsParams>,
) -> AppResult<Json<ApiResponse<PaginatedData<PostWithCategory>>>> {
    let page = params.page.unwrap_or(1).max(1);
    let size = params.size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let posts_collection = state.db.collection::<Post>("posts");
    let mut filter = doc! { "isPublished": true };

    if let Some(category_slug) = &params.category {
        let cats_collection = state.db.collection::<Category>("categories");
        if let Ok(Some(cat)) = cats_collection
            .find_one(doc! { "slug": category_slug })
            .await
        {
            filter.insert("categoryId", cat.id);
        }
    }

    // Get total count
    let total = posts_collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Fetch posts with pagination
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip)
        .limit(size as i64)
        .build();

    let mut cursor = posts_collection
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut posts = Vec::new();
    while let Some(post) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        posts.push(post);
    }

    // Enrich posts with category and AI summary
    let items = enrich_posts_with_data(&state, posts).await?;

    let total_page = ((total as f64) / (size as f64)).ceil() as i64;
    let pagination = Pagination {
        total: total as i64,
        current_page: page as i64,
        total_page,
        size: size as i64,
        has_next_page: page < total_page as u64,
        has_prev_page: page > 1,
    };

    Ok(Json(ApiResponse::success(PaginatedData {
        items,
        pagination,
    })))
}
