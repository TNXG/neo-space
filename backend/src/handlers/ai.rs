//! AI features handlers

use crate::{
    app::SharedState,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::{AiTranslation, *},
};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

/// Time capsule analysis sensitivity level
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum TimeSensitivity {
    High,
    Medium,
    Low,
}

/// Time capsule analysis result
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeCapsuleResult {
    pub sensitivity: TimeSensitivity,
    pub reason: String,
    pub markers: Vec<String>,
    #[serde(rename = "isNew")]
    pub is_new: bool,
}

/// Time capsule database document
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeCapsule {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(default = "default_language_code")]
    pub lang: String,
    #[serde(rename = "sourceLang", default = "default_language_code")]
    pub source_lang: String,
    pub hash: String,
    pub sensitivity: String,
    pub reason: String,
    pub markers: Vec<String>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub created: bson::DateTime,
}

/// Time capsule request body
#[derive(Debug, Deserialize)]
pub struct TimeCapsuleRequest {
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(default = "default_language_code")]
    pub lang: String,
}

#[derive(Debug, Deserialize)]
pub struct GetTimeCapsuleParams {
    #[serde(rename = "refType")]
    pub ref_type: Option<String>,
    pub lang: Option<String>,
}

fn default_language_code() -> String {
    "zh".to_string()
}

fn to_translation_ref_type(ref_type: &str) -> Option<&'static str> {
    match ref_type {
        "post" => Some("posts"),
        "note" => Some("notes"),
        "page" => Some("pages"),
        _ => None,
    }
}

/// Fetch content text for AI analysis
async fn fetch_content_text(
    state: &SharedState,
    ref_id: &str,
    ref_type: &str,
    lang: &str,
) -> Result<(String, String, String), AppError> {
    // Try to parse as ObjectId, return error if not valid for database entities
    let object_id = match ObjectId::parse_str(ref_id) {
        Ok(oid) => oid,
        Err(_) => {
            // For non-ObjectIds (like "friends"), the AI feature is not applicable
            return Err(AppError::BadRequest(
                "AI time capsule feature is only available for database content".to_string(),
            ));
        }
    };

    let original_content = match ref_type {
        "post" => {
            let col = state.db.collection::<Post>("posts");
            let doc = col
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("Post not found".to_string()))?;
            format!("{}\n\n{}", doc.title, doc.text)
        }
        "note" => {
            let col = state.db.collection::<Note>("notes");
            let doc = col
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("Note not found".to_string()))?;
            format!("{}\n\n{}", doc.title, doc.text)
        }
        "page" => {
            let col = state.db.collection::<Page>("pages");
            let doc = col
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("Page not found".to_string()))?;
            format!("{}\n\n{}", doc.title, doc.text)
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Invalid ref type: {}",
                ref_type
            )));
        }
    };

    if lang == "zh" {
        return Ok((original_content, "zh".to_string(), "zh".to_string()));
    }

    let Some(translation_ref_type) = to_translation_ref_type(ref_type) else {
        return Ok((original_content, "zh".to_string(), "zh".to_string()));
    };

    let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
    let translation = translations_collection
        .find_one(doc! {
            "refId": ref_id,
            "refType": translation_ref_type,
            "lang": lang
        })
        .with_options(
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created": -1 })
                .build(),
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    if let Some(translation) = translation
        && let (Some(title), Some(text)) = (translation.title, translation.text)
    {
        return Ok((
            format!("{}\n\n{}", title, text),
            translation.lang,
            translation.source_lang,
        ));
    }

    Ok((original_content, "zh".to_string(), "zh".to_string()))
}

fn capsule_language_filter(ref_id: &str, ref_type: &str, lang: &str) -> bson::Document {
    if lang == "zh" {
        doc! {
            "refId": ref_id,
            "refType": ref_type,
            "$or": [
                { "lang": "zh" },
                { "lang": { "$exists": false } }
            ]
        }
    } else {
        doc! {
            "refId": ref_id,
            "refType": ref_type,
            "lang": lang
        }
    }
}

async fn load_cached_capsule(
    collection: &mongodb::Collection<TimeCapsule>,
    ref_id: &str,
    ref_type: &str,
    lang: &str,
) -> Result<Option<TimeCapsule>, AppError> {
    collection
        .find_one(capsule_language_filter(ref_id, ref_type, lang))
        .with_options(
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created": -1 })
                .build(),
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))
}

/// Hash content for cache invalidation
fn hash_content(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Call OpenAI to analyze content time sensitivity
async fn analyze_with_openai(
    state: &SharedState,
    content: &str,
    lang: &str,
) -> Result<TimeCapsuleResult, AppError> {
    let api_key = &state.config.openai_api_key;
    if api_key.is_empty() {
        return Err(AppError::Internal(
            "OpenAI API key not configured".to_string(),
        ));
    }

    let response_language_instruction = match lang {
        "ja" => "Respond in Japanese.",
        "en" => "Respond in English.",
        _ => "Respond in Chinese.",
    };

    let prompt = format!(
        r#"Analyze the following article for time sensitivity. Determine if it contains:
- References to specific software versions, APIs, or technical specs that may become outdated
- Mentions of current events, prices, statistics, or timely information
- Language suggesting the content is time-bound ("currently", "right now", "as of 2024")

Respond with a JSON object with these fields:
- sensitivity: "high", "medium", or "low"
- reason: brief explanation in the requested language (1-2 sentences)
- markers: array of specific phrases or terms that indicate time sensitivity, also in the requested language

{}

Article content:
---
{}
---

Respond with ONLY valid JSON, no markdown or explanations."#,
        response_language_instruction,
        &content[..content.len().min(3000)]
    );

    let request_body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 500,
        "temperature": 0.3
    });

    let response = state
        .http_client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("OpenAI request failed: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "OpenAI API error ({}): {}",
            status, text
        )));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse OpenAI response: {}", e)))?;

    let content_str = json
        .get("choices")
        .and_then(|v| v.get(0))
        .and_then(|v| v.get("message"))
        .and_then(|v| v.get("content"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Internal("Invalid OpenAI response format".to_string()))?;

    // Clean up potential markdown code blocks
    let clean_content = content_str
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let parsed: serde_json::Value = serde_json::from_str(clean_content)
        .map_err(|e| AppError::Internal(format!("Failed to parse AI JSON response: {}", e)))?;

    let sensitivity = match parsed
        .get("sensitivity")
        .and_then(|v| v.as_str())
        .unwrap_or("medium")
    {
        "high" => TimeSensitivity::High,
        "low" => TimeSensitivity::Low,
        _ => TimeSensitivity::Medium,
    };

    let reason = parsed
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let markers: Vec<String> = parsed
        .get("markers")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(TimeCapsuleResult {
        sensitivity,
        reason,
        markers,
        is_new: true,
    })
}

async fn analyze_and_cache_time_capsule(
    state: &SharedState,
    collection: &mongodb::Collection<TimeCapsule>,
    ref_id: &str,
    ref_type: &str,
    lang: &str,
) -> Result<TimeCapsuleResult, AppError> {
    let (content, effective_lang, source_lang) =
        fetch_content_text(state, ref_id, ref_type, lang).await?;
    let content_hash = hash_content(&content);

    if let Some(cached) = load_cached_capsule(collection, ref_id, ref_type, &effective_lang).await?
        && cached.hash == content_hash
    {
        let sensitivity = match cached.sensitivity.as_str() {
            "high" => TimeSensitivity::High,
            "low" => TimeSensitivity::Low,
            _ => TimeSensitivity::Medium,
        };

        return Ok(TimeCapsuleResult {
            sensitivity,
            reason: cached.reason,
            markers: cached.markers,
            is_new: false,
        });
    }

    if state.config.openai_api_key.is_empty() {
        return Err(AppError::Internal("AI service not configured".to_string()));
    }

    let result = analyze_with_openai(state, &content, &effective_lang).await?;
    let sensitivity_str = match &result.sensitivity {
        TimeSensitivity::High => "high",
        TimeSensitivity::Medium => "medium",
        TimeSensitivity::Low => "low",
    };

    let new_capsule = TimeCapsule {
        id: ObjectId::new(),
        ref_id: ref_id.to_string(),
        ref_type: ref_type.to_string(),
        lang: effective_lang,
        source_lang,
        hash: content_hash,
        sensitivity: sensitivity_str.to_string(),
        reason: result.reason.clone(),
        markers: result.markers.clone(),
        created: bson::DateTime::now(),
    };

    if let Err(e) = collection.insert_one(&new_capsule).await {
        tracing::error!("Failed to insert time capsule: {}", e);
    }

    Ok(result)
}

/// Analyze content time sensitivity and cache result
pub async fn analyze_time_capsule(
    State(state): State<SharedState>,
    AppJson(payload): AppJson<TimeCapsuleRequest>,
) -> AppResult<Json<ApiResponse<TimeCapsuleResult>>> {
    let collection = state.db.collection::<TimeCapsule>("time_capsules");
    let result = analyze_and_cache_time_capsule(
        &state,
        &collection,
        &payload.ref_id,
        &payload.ref_type,
        &payload.lang,
    )
    .await?;

    Ok(Json(ApiResponse::success(result)))
}

/// Get cached time capsule analysis by ref ID
pub async fn get_time_capsule(
    State(state): State<SharedState>,
    Path(ref_id): Path<String>,
    AppQuery(params): AppQuery<GetTimeCapsuleParams>,
) -> AppResult<Json<ApiResponse<TimeCapsuleResult>>> {
    let collection = state.db.collection::<TimeCapsule>("time_capsules");
    let ref_type = params.ref_type.unwrap_or_else(|| "post".to_string());
    let lang = params.lang.unwrap_or_else(default_language_code);

    if let Some(cached) = load_cached_capsule(&collection, &ref_id, &ref_type, &lang).await? {
        let sensitivity = match cached.sensitivity.as_str() {
            "high" => TimeSensitivity::High,
            "low" => TimeSensitivity::Low,
            _ => TimeSensitivity::Medium,
        };

        return Ok(Json(ApiResponse::success(TimeCapsuleResult {
            sensitivity,
            reason: cached.reason,
            markers: cached.markers,
            is_new: false,
        })));
    }

    let result = analyze_and_cache_time_capsule(&state, &collection, &ref_id, &ref_type, &lang)
        .await?;

    Ok(Json(ApiResponse::success(result)))
}
