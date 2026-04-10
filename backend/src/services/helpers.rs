//! Shared service helpers to avoid code duplication

use crate::app::SharedState;
use crate::models::{AiSummary, AiTranslation, Category, Note, PostWithCategory, TranslationEntry};
use crate::services::oauth::OAuthService;
use axum::http::HeaderMap;
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;

/// Create an OAuthService from shared application state.
/// Centralizes construction to avoid duplicating this in multiple handlers.
pub fn make_oauth_service(state: &SharedState) -> OAuthService {
    OAuthService::new(
        state.db.clone(),
        Arc::new(state.http_client.clone()),
        state.config.github_client_id.clone(),
        state.config.github_client_secret.clone(),
        state.config.backend_url.clone(),
        state.config.qq_app_id.clone(),
        state.config.qq_app_key.clone(),
    )
}

/// Fetch the latest AI summary for a given ref ID and language.
/// Falls back to any language if exact match not found (matches Rocket behavior).
pub async fn get_ai_summary(state: &SharedState, ref_id: &str, lang: &str) -> Option<String> {
    let ai_summaries_collection = state.db.collection::<AiSummary>("ai_summaries");

    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    // Try exact language match first
    if let Ok(Some(summary)) = ai_summaries_collection
        .find_one(doc! { "refId": ref_id, "lang": lang })
        .with_options(find_options.clone())
        .await
    {
        return Some(summary.summary);
    }

    // Fallback to the original Chinese summary only.
    if lang == "zh" {
        return None;
    }

    ai_summaries_collection
        .find_one(doc! { "refId": ref_id, "lang": "zh" })
        .with_options(find_options)
        .await
        .ok()
        .flatten()
        .map(|s| s.summary)
}

/// Fetch the latest AI translation for a given ref ID, ref type and language.
pub async fn get_ai_translation(
    state: &SharedState,
    ref_id: &str,
    ref_type: &str,
    lang: &str,
) -> Option<AiTranslation> {
    if lang == "zh" {
        return None;
    }

    let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    translations_collection
        .find_one(doc! { "refId": ref_id, "refType": ref_type, "lang": lang })
        .with_options(find_options)
        .await
        .ok()
        .flatten()
}

/// Fetch the latest translated text for entity fields.
pub async fn get_entity_translation_map(
    state: &SharedState,
    key_path: &str,
    lang: &str,
    lookup_keys: &[String],
) -> HashMap<String, String> {
    if lang == "zh" || lookup_keys.is_empty() {
        return HashMap::new();
    }

    let distinct_lookup_keys: Vec<String> = lookup_keys
        .iter()
        .cloned()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    if distinct_lookup_keys.is_empty() {
        return HashMap::new();
    }

    let translations_collection = state
        .db
        .collection::<TranslationEntry>("translation_entries");
    let filter = doc! {
        "lang": lang,
        "keyPath": key_path,
        "keyType": "entity",
        "lookupKey": { "$in": &distinct_lookup_keys }
    };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "lookupKey": 1, "sourceUpdatedAt": -1, "created": -1 })
        .build();

    let mut translation_map = HashMap::new();

    match translations_collection
        .find(filter)
        .with_options(find_options)
        .await
    {
        Ok(mut cursor) => {
            while let Ok(Some(entry)) = cursor.try_next().await {
                translation_map
                    .entry(entry.lookup_key.clone())
                    .or_insert(entry.translated_text);
            }
        }
        Err(error) => {
            tracing::error!(
                "Failed to fetch entity translations for {}: {}",
                key_path,
                error
            );
        }
    }

    translation_map
}

/// Fetch the latest translated text for dictionary fields.
pub async fn get_dict_translation_map(
    state: &SharedState,
    key_path: &str,
    lang: &str,
    source_texts: &[String],
) -> HashMap<String, String> {
    if lang == "zh" || source_texts.is_empty() {
        return HashMap::new();
    }

    let distinct_source_texts: Vec<String> = source_texts
        .iter()
        .cloned()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();

    if distinct_source_texts.is_empty() {
        return HashMap::new();
    }

    let translations_collection = state
        .db
        .collection::<TranslationEntry>("translation_entries");
    let filter = doc! {
        "lang": lang,
        "keyPath": key_path,
        "keyType": "dict",
        "sourceText": { "$in": &distinct_source_texts }
    };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "sourceText": 1, "created": -1 })
        .build();

    let mut translation_map = HashMap::new();

    match translations_collection
        .find(filter)
        .with_options(find_options)
        .await
    {
        Ok(mut cursor) => {
            while let Ok(Some(entry)) = cursor.try_next().await {
                translation_map
                    .entry(entry.source_text.clone())
                    .or_insert(entry.translated_text);
            }
        }
        Err(error) => {
            tracing::error!(
                "Failed to fetch dict translations for {}: {}",
                key_path,
                error
            );
        }
    }

    translation_map
}

/// Fetch localized category names by category ObjectId.
pub async fn get_category_name_translation_map(
    state: &SharedState,
    category_ids: &[ObjectId],
    lang: &str,
) -> HashMap<String, String> {
    let lookup_keys: Vec<String> = category_ids
        .iter()
        .map(|category_id| category_id.to_hex())
        .collect();
    get_entity_translation_map(state, "category.name", lang, &lookup_keys).await
}

/// Apply category name translations in-place.
pub fn localize_category_names<'a>(
    categories: impl IntoIterator<Item = &'a mut Category>,
    translation_map: &HashMap<String, String>,
) {
    for category in categories {
        if let Some(translated_name) = translation_map.get(&category.id.to_hex()) {
            category.name = translated_name.clone();
        }
    }
}

/// Apply note mood/weather dictionary translations in-place.
pub fn localize_note_taxonomy_fields<'a>(
    notes: impl IntoIterator<Item = &'a mut Note>,
    mood_translation_map: &HashMap<String, String>,
    weather_translation_map: &HashMap<String, String>,
) {
    for note in notes {
        if let Some(mood) = note.mood.as_mut()
            && let Some(translated_mood) = mood_translation_map.get(mood)
        {
            *mood = translated_mood.clone();
        }

        if let Some(weather) = note.weather.as_mut()
            && let Some(translated_weather) = weather_translation_map.get(weather)
        {
            *weather = translated_weather.clone();
        }
    }
}

/// Apply translation fields onto a post payload.
pub fn apply_translation_to_post(post: &mut PostWithCategory, translation: &AiTranslation) {
    if let Some(title) = &translation.title {
        post.title = title.clone();
    }
    if let Some(text) = &translation.text {
        post.text = text.clone();
    }
    if let Some(summary) = &translation.summary {
        post.ai_summary = Some(summary.clone());
    }
    if !translation.tags.is_empty() {
        post.tags = translation.tags.clone();
    }
    post.lang = translation.lang.clone();
    post.source_lang = translation.source_lang.clone();
    post.is_ai_translated = true;
}

/// Apply translation fields onto a note payload.
pub fn apply_translation_to_note(note: &mut Note, translation: &AiTranslation) {
    if let Some(title) = &translation.title {
        note.title = title.clone();
    }
    if let Some(text) = &translation.text {
        note.text = text.clone();
    }
    if let Some(summary) = &translation.summary {
        note.ai_summary = Some(summary.clone());
    }
    if !translation.tags.is_empty() {
        // Note model currently has no tags field. Ignore intentionally.
    }
    note.lang = translation.lang.clone();
    note.source_lang = translation.source_lang.clone();
    note.is_ai_translated = true;
}

/// Verify Cloudflare Turnstile CAPTCHA token.
/// Extracted from comment handler for reuse and to populate external/captcha.rs.
pub async fn verify_turnstile(
    token: &str,
    secret: &str,
    http_client: &reqwest::Client,
) -> Result<(), ()> {
    let response = http_client
        .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .form(&[("secret", secret), ("response", token)])
        .send()
        .await
        .map_err(|_| ())?;

    let json: serde_json::Value = response.json().await.map_err(|_| ())?;

    if json
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(())
    }
}

/// Extract client IP from request headers (X-Forwarded-For > X-Real-IP > CF-Connecting-IP)
pub fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok())
        && let Some(first_ip) = xff.split(',').next()
    {
        let ip = first_ip.trim().to_string();
        if !ip.is_empty() {
            return Some(ip);
        }
    }
    if let Some(real_ip) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        let ip = real_ip.trim().to_string();
        if !ip.is_empty() {
            return Some(ip);
        }
    }
    if let Some(cf_ip) = headers
        .get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok())
    {
        let ip = cf_ip.trim().to_string();
        if !ip.is_empty() {
            return Some(ip);
        }
    }
    None
}
