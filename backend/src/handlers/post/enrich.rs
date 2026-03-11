//! Post enrichment helpers (category + AI summary)

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::*,
    services::helpers::get_ai_summary,
};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;

/// Fetch category by ID
pub async fn fetch_category_by_id(
    state: &SharedState,
    category_id: ObjectId,
) -> AppResult<Option<Category>> {
    let categories_collection = state.db.collection::<Category>("categories");
    categories_collection
        .find_one(doc! { "_id": category_id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))
}

/// Enrich a single post with category and AI summary
pub async fn enrich_single_post(
    state: &SharedState,
    post: Post,
    post_id: &str,
) -> AppResult<PostWithCategory> {
    let category = fetch_category_by_id(state, post.category_id).await?;
    let ai_summary = get_ai_summary(state, post_id, "zh").await;

    let mut post_with_category = PostWithCategory::from(post);
    post_with_category.category = category;
    post_with_category.ai_summary = ai_summary;

    Ok(post_with_category)
}

/// Enrich multiple posts with category and AI summary (batch queries to avoid N+1)
pub async fn enrich_posts_with_data(
    state: &SharedState,
    posts: Vec<Post>,
) -> AppResult<Vec<PostWithCategory>> {
    if posts.is_empty() {
        return Ok(Vec::new());
    }

    // Collect all unique category IDs
    let category_ids: Vec<ObjectId> = posts
        .iter()
        .map(|p| p.category_id)
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    // Fetch all categories at once
    let categories_collection = state.db.collection::<Category>("categories");
    let mut category_map = std::collections::HashMap::new();

    if !category_ids.is_empty() {
        let filter = doc! { "_id": { "$in": category_ids } };
        match categories_collection.find(filter).await {
            Ok(mut cursor) => {
                while let Ok(Some(category)) = cursor.try_next().await {
                    category_map.insert(category.id, category);
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch categories: {}", e);
            }
        }
    }

    // Collect post IDs for AI summaries
    let post_ids: Vec<String> = posts.iter().map(|p| p.id.to_hex()).collect();

    // Fetch all AI summaries at once
    let ai_summaries_collection = state.db.collection::<AiSummary>("ai_summaries");
    let mut ai_summary_map = std::collections::HashMap::new();

    if !post_ids.is_empty() {
        let filter = doc! { "refId": { "$in": &post_ids }, "lang": "zh" };
        let find_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "created": -1 })
            .build();

        match ai_summaries_collection
            .find(filter)
            .with_options(find_options)
            .await
        {
            Ok(mut cursor) => {
                while let Ok(Some(summary)) = cursor.try_next().await {
                    // Only keep the first (latest) summary for each refId
                    ai_summary_map
                        .entry(summary.ref_id.clone())
                        .or_insert(summary.summary);
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch AI summaries: {}", e);
            }
        }
    }

    // Build enriched posts
    let mut enriched_posts = Vec::new();
    for post in posts {
        let post_id = post.id.to_hex();
        let category = category_map.get(&post.category_id).cloned();
        let ai_summary = ai_summary_map.get(&post_id).cloned();

        let mut post_with_category = PostWithCategory::from(post);
        post_with_category.category = category;
        post_with_category.ai_summary = ai_summary;
        enriched_posts.push(post_with_category);
    }

    Ok(enriched_posts)
}
