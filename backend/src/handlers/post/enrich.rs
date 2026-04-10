//! Post enrichment helpers (category + AI summary)

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::*,
    services::helpers::{
        apply_translation_to_post, get_ai_summary, get_ai_translation,
        get_category_name_translation_map, localize_category_names,
    },
};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use std::collections::{HashMap, HashSet};

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
    lang: &str,
) -> AppResult<PostWithCategory> {
    let category = fetch_category_by_id(state, post.category_id).await?;
    let ai_summary = get_ai_summary(state, post_id, lang).await;

    let mut post_with_category = PostWithCategory::from(post);
    let mut localized_category = category;
    if let Some(category) = localized_category.as_mut() {
        let translation_map = get_category_name_translation_map(state, &[category.id], lang).await;
        localize_category_names(std::iter::once(category), &translation_map);
    }
    post_with_category.category = localized_category;
    post_with_category.ai_summary = ai_summary;

    if let Some(translation) = get_ai_translation(state, post_id, "posts", lang).await {
        apply_translation_to_post(&mut post_with_category, &translation);
    }

    Ok(post_with_category)
}

/// Enrich multiple posts with category and AI summary (batch queries to avoid N+1)
pub async fn enrich_posts_with_data(
    state: &SharedState,
    posts: Vec<Post>,
    lang: &str,
) -> AppResult<Vec<PostWithCategory>> {
    if posts.is_empty() {
        return Ok(Vec::new());
    }

    // Collect all unique category IDs
    let category_ids: Vec<ObjectId> = posts
        .iter()
        .map(|p| p.category_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    // Fetch all categories at once
    let categories_collection = state.db.collection::<Category>("categories");
    let mut category_map = HashMap::new();

    if !category_ids.is_empty() {
        let filter = doc! { "_id": { "$in": &category_ids } };
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

    let category_translation_map =
        get_category_name_translation_map(state, &category_ids, lang).await;
    localize_category_names(category_map.values_mut(), &category_translation_map);

    // Collect post IDs for AI summaries
    let post_ids: Vec<String> = posts.iter().map(|p| p.id.to_hex()).collect();

    // Fetch all AI summaries at once
    let ai_summaries_collection = state.db.collection::<AiSummary>("ai_summaries");
    let mut ai_summary_map = HashMap::new();

    if !post_ids.is_empty() {
        let summary_langs = if lang == "zh" {
            vec!["zh"]
        } else {
            vec![lang, "zh"]
        };
        let filter = doc! { "refId": { "$in": &post_ids }, "lang": { "$in": &summary_langs } };
        let find_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "refId": 1, "created": -1 })
            .build();

        match ai_summaries_collection
            .find(filter)
            .with_options(find_options)
            .await
        {
            Ok(mut cursor) => {
                let mut zh_fallback_map = HashMap::new();
                while let Ok(Some(summary)) = cursor.try_next().await {
                    if summary.lang == lang {
                        ai_summary_map
                            .entry(summary.ref_id.clone())
                            .or_insert(summary.summary.clone());
                        continue;
                    }

                    if summary.lang == "zh" {
                        zh_fallback_map
                            .entry(summary.ref_id.clone())
                            .or_insert(summary.summary);
                    }
                }

                for (ref_id, summary) in zh_fallback_map {
                    ai_summary_map.entry(ref_id).or_insert(summary);
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch AI summaries: {}", e);
            }
        }
    }

    let mut translation_map = HashMap::new();
    if lang != "zh" && !post_ids.is_empty() {
        let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
        let translation_filter = doc! {
            "refId": { "$in": &post_ids },
            "refType": "posts",
            "lang": lang
        };
        let translation_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "refId": 1, "created": -1 })
            .build();

        match translations_collection
            .find(translation_filter)
            .with_options(translation_options)
            .await
        {
            Ok(mut cursor) => {
                while let Ok(Some(translation)) = cursor.try_next().await {
                    translation_map
                        .entry(translation.ref_id.clone())
                        .or_insert(translation);
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch AI translations: {}", e);
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
        if let Some(translation) = translation_map.get(&post_id) {
            apply_translation_to_post(&mut post_with_category, translation);
        }
        enriched_posts.push(post_with_category);
    }

    Ok(enriched_posts)
}
