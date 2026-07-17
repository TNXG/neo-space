//! Search handlers

use crate::{
    app::SharedState,
    error::{AppError, AppQuery, AppResult},
    external::search::*,
    models::*,
    services::helpers::{get_category_name_translation_map, localize_category_names},
};
use axum::{Json, extract::State};
use bson::doc;
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Search parameters
#[derive(Debug, Deserialize)]
pub struct SearchParams {
    /// Search query string
    q: Option<String>,
    /// Search type: "post" or "note" (empty for both)
    #[serde(rename = "type")]
    type_: Option<String>,
    /// Maximum results per type (default: 10, max: 50)
    limit: Option<usize>,
    /// Offset for pagination (default: 0)
    offset: Option<usize>,
    /// Enable semantic search (default: false)
    semantic: Option<bool>,
    /// Response locale for translated entity labels
    lang: Option<String>,
}

/// Category information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryInfo {
    pub name: String,
    pub slug: String,
}

/// Post search result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchPostResult {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub category: Option<CategoryInfo>,
    pub tags: Vec<String>,
    pub created: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlighted_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_highlight: Option<String>,
    pub score: f64,
}

/// Note search result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchNoteResult {
    pub id: String,
    pub title: String,
    pub nid: i32,
    pub created: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlighted_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_highlight: Option<String>,
    pub score: f64,
}

/// Combined search results
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResults {
    pub posts: Vec<SearchPostResult>,
    pub notes: Vec<SearchNoteResult>,
}

/// Search across posts and notes
pub async fn search(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<SearchParams>,
) -> AppResult<Json<ApiResponse<SearchResults>>> {
    // Check if Meilisearch is configured
    let config = state.config();
    let search_host = config.meilisearch_host.clone();
    let api_key = if config.meilisearch_api_key.is_empty() {
        None
    } else {
        Some(config.meilisearch_api_key.clone())
    };

    // Validate query parameter
    let query = params
        .q
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError::BadRequest("Missing search query".to_string()))?;

    let limit = params.limit.unwrap_or(10).min(50);
    let offset = params.offset.unwrap_or(0);
    let search_type = params.type_.as_deref();
    let _semantic = params.semantic.unwrap_or(false);
    let lang = params.lang.as_deref().unwrap_or("zh");

    let search_service = SearchService::new(search_host, api_key)?;

    let mut results = SearchResults {
        posts: vec![],
        notes: vec![],
    };

    // Search posts
    if search_type.is_none() || search_type == Some("post") {
        match search_service
            .search_posts(&query, limit, offset, lang)
            .await
        {
            Ok(hits) => {
                let category_slugs: Vec<String> = hits
                    .iter()
                    .filter_map(|hit| hit.doc.category.clone())
                    .collect::<HashSet<_>>()
                    .into_iter()
                    .collect();

                let mut localized_category_name_by_slug = HashMap::new();
                if !category_slugs.is_empty() {
                    let categories_collection = state.db.collection::<Category>("categories");
                    let filter = doc! { "slug": { "$in": &category_slugs } };

                    match categories_collection.find(filter).await {
                        Ok(mut cursor) => {
                            let mut categories = Vec::new();
                            while let Ok(Some(category)) = cursor.try_next().await {
                                categories.push(category);
                            }

                            let category_ids = categories
                                .iter()
                                .map(|category| category.id)
                                .collect::<Vec<_>>();
                            let translation_map =
                                get_category_name_translation_map(&state, &category_ids, lang)
                                    .await;
                            localize_category_names(categories.iter_mut(), &translation_map);

                            localized_category_name_by_slug = categories
                                .into_iter()
                                .map(|category| (category.slug, category.name))
                                .collect();
                        }
                        Err(error) => {
                            tracing::error!(
                                "Failed to fetch categories for search results: {}",
                                error
                            );
                        }
                    }
                }

                results.posts = hits
                    .into_iter()
                    .map(|hit| SearchPostResult {
                        id: hit.doc.ref_id,
                        title: hit.doc.title,
                        slug: hit.doc.slug,
                        category: match (hit.doc.category, hit.doc.category_name) {
                            (Some(slug), Some(name)) => Some(CategoryInfo {
                                name: localized_category_name_by_slug
                                    .get(&slug)
                                    .cloned()
                                    .unwrap_or(name),
                                slug,
                            }),
                            _ => None,
                        },
                        tags: hit.doc.tags,
                        created: hit.doc.created,
                        highlighted_title: hit.formatted.get("title").cloned(),
                        content_highlight: hit.formatted.get("text").cloned(),
                        score: hit.score,
                    })
                    .collect();
            }
            Err(e) => {
                tracing::error!("Failed to search posts: {:?}", e);
            }
        }
    }

    // Search notes
    if search_type.is_none() || search_type == Some("note") {
        match search_service
            .search_notes(&query, limit, offset, lang)
            .await
        {
            Ok(hits) => {
                results.notes = hits
                    .into_iter()
                    .map(|hit| SearchNoteResult {
                        id: hit.doc.ref_id,
                        title: hit.doc.title,
                        nid: hit.doc.nid,
                        created: hit.doc.created,
                        highlighted_title: hit.formatted.get("title").cloned(),
                        content_highlight: hit.formatted.get("text").cloned(),
                        score: hit.score,
                    })
                    .collect();
            }
            Err(e) => {
                tracing::error!("Failed to search notes: {:?}", e);
            }
        }
    }

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: results,
    }))
}
