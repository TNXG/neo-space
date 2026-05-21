use std::collections::HashMap;

use futures::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};

use crate::app::SharedState;
use crate::models::{AiTranslation, Category};
use crate::services::helpers::get_category_name_translation_map;

fn collect_latest_translations_by_ref_and_lang(
    translations: Vec<AiTranslation>,
) -> HashMap<(String, String), AiTranslation> {
    let mut translation_map = HashMap::new();

    for translation in translations {
        translation_map
            .entry((translation.ref_id.clone(), translation.lang.clone()))
            .or_insert(translation);
    }

    translation_map
}

pub(super) async fn fetch_post_translation_map(
    state: &SharedState,
    post_ids: &[String],
) -> HashMap<(String, String), AiTranslation> {
    if post_ids.is_empty() {
        return HashMap::new();
    }

    let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
    let filter = doc! {
        "refId": { "$in": post_ids },
        "refType": "posts",
    };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "refId": 1, "lang": 1, "created": -1 })
        .build();

    match translations_collection
        .find(filter)
        .with_options(find_options)
        .await
    {
        Ok(cursor) => match cursor.try_collect().await {
            Ok(translations) => collect_latest_translations_by_ref_and_lang(translations),
            Err(error) => {
                tracing::error!(
                    "Failed to read post translations for Meilisearch sync: {}",
                    error
                );
                HashMap::new()
            }
        },
        Err(error) => {
            tracing::error!(
                "Failed to fetch post translations for Meilisearch sync: {}",
                error
            );
            HashMap::new()
        }
    }
}

pub(super) async fn fetch_note_translation_map(
    state: &SharedState,
    note_ids: &[String],
) -> HashMap<(String, String), AiTranslation> {
    if note_ids.is_empty() {
        return HashMap::new();
    }

    let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
    let filter = doc! {
        "refId": { "$in": note_ids },
        "refType": "notes",
    };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "refId": 1, "lang": 1, "created": -1 })
        .build();

    match translations_collection
        .find(filter)
        .with_options(find_options)
        .await
    {
        Ok(cursor) => match cursor.try_collect().await {
            Ok(translations) => collect_latest_translations_by_ref_and_lang(translations),
            Err(error) => {
                tracing::error!(
                    "Failed to read note translations for Meilisearch sync: {}",
                    error
                );
                HashMap::new()
            }
        },
        Err(error) => {
            tracing::error!(
                "Failed to fetch note translations for Meilisearch sync: {}",
                error
            );
            HashMap::new()
        }
    }
}

pub(super) async fn fetch_category_map(
    state: &SharedState,
    category_ids: &[ObjectId],
) -> HashMap<ObjectId, Category> {
    if category_ids.is_empty() {
        return HashMap::new();
    }

    let categories_collection = state.db.collection::<Category>("categories");
    let filter = doc! { "_id": { "$in": category_ids } };

    match categories_collection.find(filter).await {
        Ok(cursor) => cursor
            .try_collect::<Vec<Category>>()
            .await
            .map(|categories| {
                categories
                    .into_iter()
                    .map(|category| (category.id, category))
                    .collect()
            })
            .unwrap_or_else(|error| {
                tracing::error!("Failed to read categories for Meilisearch sync: {}", error);
                HashMap::new()
            }),
        Err(error) => {
            tracing::error!("Failed to fetch categories for Meilisearch sync: {}", error);
            HashMap::new()
        }
    }
}

pub(super) async fn fetch_category_translation_maps(
    state: &SharedState,
    category_ids: &[ObjectId],
    languages: &[String],
) -> HashMap<String, HashMap<String, String>> {
    let mut result = HashMap::new();

    for lang in languages.iter().filter(|lang| lang.as_str() != "zh") {
        let translation_map = get_category_name_translation_map(state, category_ids, lang).await;
        result.insert(lang.clone(), translation_map);
    }

    result
}
