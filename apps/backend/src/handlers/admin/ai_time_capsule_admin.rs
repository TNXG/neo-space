//! 时光胶囊内容总览接口。

use std::collections::{HashMap, HashSet};

use axum::{Json, extract::State};
use bson::{DateTime, doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppQuery, AppResult},
    models::{ApiResponse, Pagination},
};

#[derive(Debug, Deserialize)]
struct ContentProjection {
    #[serde(rename = "_id")]
    id: ObjectId,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    content: Option<String>,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    created: DateTime,
}

#[derive(Debug, Deserialize)]
struct CapsuleProjection {
    #[serde(rename = "refId")]
    ref_id: String,
    #[serde(rename = "refType")]
    ref_type: String,
    #[serde(default = "default_language")]
    lang: String,
    sensitivity: String,
    reason: String,
    #[serde(default)]
    markers: Vec<String>,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    created: DateTime,
}

#[derive(Debug, Deserialize)]
struct TranslationLanguageProjection {
    #[serde(rename = "refId")]
    ref_id: String,
    #[serde(rename = "refType")]
    ref_type: String,
    lang: String,
}

#[derive(Debug, Serialize)]
pub struct CapsuleSummary {
    pub lang: String,
    pub sensitivity: String,
    pub reason: String,
    pub markers: Vec<String>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub created: DateTime,
}

#[derive(Debug, Serialize)]
pub struct TimeCapsuleContent {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "type")]
    pub ref_type: String,
    pub title: String,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub created: DateTime,
    #[serde(rename = "availableLanguages")]
    pub available_languages: Vec<String>,
    pub capsules: Vec<CapsuleSummary>,
}

#[derive(Debug, Serialize)]
pub struct TimeCapsuleContentsResponse {
    pub items: Vec<TimeCapsuleContent>,
    pub pagination: Pagination,
}

#[derive(Debug, Deserialize)]
pub struct TimeCapsuleContentsQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub search: Option<String>,
    #[serde(rename = "type")]
    pub ref_type: Option<String>,
}

fn default_language() -> String {
    "zh".to_string()
}

fn normalize_ref_type(ref_type: &str) -> &str {
    match ref_type {
        "posts" | "Post" => "post",
        "notes" | "Note" => "note",
        "pages" | "Page" => "page",
        "Recently" => "recently",
        value => value,
    }
}

async fn append_collection(
    state: &SharedState,
    collection_name: &str,
    ref_type: &str,
    contents: &mut Vec<TimeCapsuleContent>,
) -> AppResult<()> {
    let mut cursor = state
        .db
        .collection::<ContentProjection>(collection_name)
        .find(doc! {})
        .projection(doc! { "_id": 1, "title": 1, "content": 1, "created": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    while let Some(content) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        let title = content
            .title
            .or(content.content)
            .unwrap_or_else(|| "无标题".to_string());
        contents.push(TimeCapsuleContent {
            id: content.id.to_hex(),
            ref_type: ref_type.to_string(),
            title: title.chars().take(80).collect(),
            created: content.created,
            available_languages: vec!["zh".to_string()],
            capsules: Vec::new(),
        });
    }
    Ok(())
}

pub async fn list_contents(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(query): AppQuery<TimeCapsuleContentsQuery>,
) -> AppResult<Json<ApiResponse<TimeCapsuleContentsResponse>>> {
    let page = query.page.unwrap_or(1).max(1);
    let size = query.size.unwrap_or(30).clamp(1, 100);
    let mut contents = Vec::new();

    append_collection(&state, "posts", "post", &mut contents).await?;
    append_collection(&state, "notes", "note", &mut contents).await?;
    append_collection(&state, "pages", "page", &mut contents).await?;
    append_collection(&state, "recently", "recently", &mut contents).await?;

    if let Some(ref_type) = query.ref_type.as_deref().filter(|value| !value.is_empty()) {
        let normalized = normalize_ref_type(ref_type);
        contents.retain(|content| content.ref_type == normalized);
    }
    if let Some(search) = query
        .search
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        let keyword = search.trim().to_lowercase();
        contents.retain(|content| content.title.to_lowercase().contains(&keyword));
    }
    contents.sort_by_key(|content| std::cmp::Reverse(content.created));

    let total = contents.len() as i64;
    let mut items: Vec<TimeCapsuleContent> = contents
        .into_iter()
        .skip(((page - 1) * size) as usize)
        .take(size as usize)
        .collect();
    let content_ids: Vec<String> = items.iter().map(|content| content.id.clone()).collect();
    let mut capsule_map: HashMap<(String, String), Vec<CapsuleSummary>> = HashMap::new();
    let mut language_map: HashMap<(String, String), HashSet<String>> = HashMap::new();

    if !content_ids.is_empty() {
        let mut translation_cursor = state
            .db
            .collection::<TranslationLanguageProjection>("ai_translations")
            .find(doc! { "refId": { "$in": &content_ids } })
            .await
            .map_err(|error| AppError::Database(error.to_string()))?;
        while let Some(translation) = translation_cursor
            .try_next()
            .await
            .map_err(|error| AppError::Database(error.to_string()))?
        {
            language_map
                .entry((
                    translation.ref_id,
                    normalize_ref_type(&translation.ref_type).to_string(),
                ))
                .or_default()
                .insert(translation.lang);
        }

        let mut cursor = state
            .db
            .collection::<CapsuleProjection>("time_capsules")
            .find(doc! { "refId": { "$in": &content_ids } })
            .sort(doc! { "created": -1 })
            .await
            .map_err(|error| AppError::Database(error.to_string()))?;
        while let Some(capsule) = cursor
            .try_next()
            .await
            .map_err(|error| AppError::Database(error.to_string()))?
        {
            capsule_map
                .entry((
                    capsule.ref_id,
                    normalize_ref_type(&capsule.ref_type).to_string(),
                ))
                .or_default()
                .push(CapsuleSummary {
                    lang: capsule.lang,
                    sensitivity: capsule.sensitivity,
                    reason: capsule.reason,
                    markers: capsule.markers,
                    created: capsule.created,
                });
        }
    }

    for content in &mut items {
        if let Some(languages) =
            language_map.remove(&(content.id.clone(), content.ref_type.clone()))
        {
            content.available_languages.extend(languages);
            content.available_languages.sort();
            content.available_languages.dedup();
        }
        content.capsules = capsule_map
            .remove(&(content.id.clone(), content.ref_type.clone()))
            .unwrap_or_default();
    }

    Ok(Json(ApiResponse::success(TimeCapsuleContentsResponse {
        items,
        pagination: Pagination::new(total, page as i64, size as i64),
    })))
}
