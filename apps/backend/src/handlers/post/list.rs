//! Post list handler

use crate::{
    app::SharedState,
    auth::extractors::OptionalAuth,
    error::{AppError, AppQuery, AppResult},
    models::*,
};
use axum::{extract::State, response::Json};
use bson::{Regex, doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::Deserialize;

use super::enrich::enrich_posts_with_data;

fn escape_mongo_regex(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(
            ch,
            '\\' | '.' | '+' | '*' | '?' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '^' | '$'
        ) {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}

#[derive(Debug, Deserialize)]
pub struct ListPostsParams {
    page: Option<u64>,
    size: Option<u64>,
    category: Option<String>,
    #[serde(rename = "categoryIds")]
    category_ids: Option<String>,
    keyword: Option<String>,
    #[serde(rename = "sortBy")]
    sort_by: Option<String>,
    #[serde(rename = "sortOrder")]
    sort_order: Option<i32>,
    lang: Option<String>,
}

/// List published posts with pagination
pub async fn list_posts(
    State(state): State<SharedState>,
    auth: OptionalAuth,
    AppQuery(params): AppQuery<ListPostsParams>,
) -> AppResult<Json<ApiResponse<PaginatedData<PostWithCategory>>>> {
    let page = params.page.unwrap_or(1).max(1);
    let size = params.size.unwrap_or(10).clamp(1, 100);
    let lang = params.lang.as_deref().unwrap_or("zh");
    let skip = (page - 1) * size;

    let posts_collection = state.db.collection::<Post>("posts");
    let mut filter = if auth.is_owner {
        doc! {}
    } else {
        doc! { "isPublished": true }
    };

    if let Some(category_slug) = &params.category {
        let cats_collection = state.db.collection::<Category>("categories");
        if let Ok(Some(cat)) = cats_collection
            .find_one(doc! { "slug": category_slug })
            .await
        {
            filter.insert("categoryId", cat.id);
        }
    }

    if let Some(category_ids) = &params.category_ids {
        let ids = category_ids
            .split(',')
            .filter(|id| !id.trim().is_empty())
            .map(|id| ObjectId::parse_str(id.trim()))
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| AppError::BadRequest("Invalid categoryIds".to_string()))?;
        if !ids.is_empty() {
            filter.insert("categoryId", doc! { "$in": ids });
        }
    }

    if let Some(keyword) = params
        .keyword
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        let pattern = escape_mongo_regex(keyword.trim());
        filter.insert(
            "$or",
            vec![
                doc! { "title": { "$regex": Regex { pattern: pattern.clone(), options: "i".to_string() } } },
                doc! { "text": { "$regex": Regex { pattern, options: "i".to_string() } } },
            ],
        );
    }

    let total = posts_collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let sort_field = match params.sort_by.as_deref() {
        Some("createdAt") | Some("created") => "created",
        Some("modifiedAt") | Some("modified") => "modified",
        Some("title") => "title",
        _ => "created",
    };
    let sort_order = if params.sort_order == Some(1) { 1 } else { -1 };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { sort_field: sort_order })
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

    let items = enrich_posts_with_data(&state, posts, lang).await?;

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
