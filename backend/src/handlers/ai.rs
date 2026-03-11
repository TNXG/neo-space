//! AI features handlers

use crate::{
    app::SharedState,
    error::{AppError, AppJson, AppResult},
    models::*,
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
}

/// Fetch content text for AI analysis
async fn fetch_content_text(
    state: &SharedState,
    ref_id: &str,
    ref_type: &str,
) -> Result<String, AppError> {
    let object_id = ObjectId::parse_str(ref_id)
        .map_err(|_| AppError::BadRequest("Invalid ref ID format".to_string()))?;

    match ref_type {
        "post" => {
            let col = state.db.collection::<Post>("posts");
            let doc = col
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("Post not found".to_string()))?;
            Ok(format!("{}\n\n{}", doc.title, doc.text))
        }
        "note" => {
            let col = state.db.collection::<Note>("notes");
            let doc = col
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("Note not found".to_string()))?;
            Ok(format!("{}\n\n{}", doc.title, doc.text))
        }
        "page" => {
            let col = state.db.collection::<Page>("pages");
            let doc = col
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?
                .ok_or_else(|| AppError::NotFound("Page not found".to_string()))?;
            Ok(format!("{}\n\n{}", doc.title, doc.text))
        }
        _ => Err(AppError::BadRequest(format!(
            "Invalid ref type: {}",
            ref_type
        ))),
    }
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
) -> Result<TimeCapsuleResult, AppError> {
    let api_key = &state.config.openai_api_key;
    if api_key.is_empty() {
        return Err(AppError::Internal(
            "OpenAI API key not configured".to_string(),
        ));
    }

    let prompt = format!(
        r#"Analyze the following article for time sensitivity. Determine if it contains:
- References to specific software versions, APIs, or technical specs that may become outdated
- Mentions of current events, prices, statistics, or timely information
- Language suggesting the content is time-bound ("currently", "right now", "as of 2024")

Respond with a JSON object with these fields:
- sensitivity: "high", "medium", or "low"
- reason: brief explanation in Chinese (1-2 sentences)
- markers: array of specific phrases/terms that indicate time sensitivity

Article content:
---
{}
---

Respond with ONLY valid JSON, no markdown or explanations."#,
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

    let content_str = json["choices"][0]["message"]["content"]
        .as_str()
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

    let sensitivity = match parsed["sensitivity"].as_str().unwrap_or("medium") {
        "high" => TimeSensitivity::High,
        "low" => TimeSensitivity::Low,
        _ => TimeSensitivity::Medium,
    };

    let reason = parsed["reason"].as_str().unwrap_or("").to_string();
    let markers: Vec<String> = parsed["markers"]
        .as_array()
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

/// Analyze content time sensitivity and cache result
pub async fn analyze_time_capsule(
    State(state): State<SharedState>,
    AppJson(payload): AppJson<TimeCapsuleRequest>,
) -> AppResult<Json<ApiResponse<TimeCapsuleResult>>> {
    let content = fetch_content_text(&state, &payload.ref_id, &payload.ref_type).await?;
    let content_hash = hash_content(&content);

    let collection = state.db.collection::<TimeCapsule>("time_capsules");

    // Check cache: find existing analysis with same content hash
    if let Ok(Some(cached)) = collection
        .find_one(doc! { "refId": &payload.ref_id, "hash": &content_hash })
        .with_options(
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created": -1 })
                .build(),
        )
        .await
    {
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

    // Perform AI analysis
    if state.config.openai_api_key.is_empty() {
        return Err(AppError::Internal("AI service not configured".to_string()));
    }

    let result = analyze_with_openai(&state, &content).await?;

    // Store in database
    let sensitivity_str = match &result.sensitivity {
        TimeSensitivity::High => "high",
        TimeSensitivity::Medium => "medium",
        TimeSensitivity::Low => "low",
    };

    let new_capsule = TimeCapsule {
        id: ObjectId::new(),
        ref_id: payload.ref_id.clone(),
        ref_type: payload.ref_type.clone(),
        hash: content_hash,
        sensitivity: sensitivity_str.to_string(),
        reason: result.reason.clone(),
        markers: result.markers.clone(),
        created: bson::DateTime::now(),
    };

    if let Err(e) = collection.insert_one(&new_capsule).await {
        tracing::error!("Failed to insert time capsule: {}", e);
    }

    Ok(Json(ApiResponse::success(result)))
}

/// Get cached time capsule analysis by ref ID
pub async fn get_time_capsule(
    State(state): State<SharedState>,
    Path(ref_id): Path<String>,
) -> AppResult<Json<ApiResponse<TimeCapsuleResult>>> {
    let collection = state.db.collection::<TimeCapsule>("time_capsules");

    let cached = collection
        .find_one(doc! { "refId": &ref_id })
        .with_options(
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created": -1 })
                .build(),
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Time capsule analysis not found".to_string()))?;

    let sensitivity = match cached.sensitivity.as_str() {
        "high" => TimeSensitivity::High,
        "low" => TimeSensitivity::Low,
        _ => TimeSensitivity::Medium,
    };

    Ok(Json(ApiResponse::success(TimeCapsuleResult {
        sensitivity,
        reason: cached.reason,
        markers: cached.markers,
        is_new: false,
    })))
}
