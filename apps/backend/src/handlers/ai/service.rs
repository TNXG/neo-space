use axum::{
    Json,
    extract::{Path, State},
};
use bson::oid::ObjectId;

use crate::{
    app::SharedState,
    error::{AppError, AppJson, AppQuery, AppResult},
    external::ai::{AiService, AiUsage, ChatMessage, ChatRole},
};

use super::repository::{fetch_content_text, hash_content, load_cached_capsule};
use super::types::{
    GetTimeCapsuleParams, TimeCapsule, TimeCapsuleRequest, TimeCapsuleResult, TimeSensitivity,
    default_language_code,
};

fn truncate_for_prompt(content: &str, max_chars: usize) -> String {
    content.chars().take(max_chars).collect()
}

async fn analyze_with_openai(
    state: &SharedState,
    content: &str,
    lang: &str,
) -> Result<TimeCapsuleResult, AppError> {
    let ai_service =
        AiService::from_database_for_usage(&state.db, state.http_client.clone(), AiUsage::Summary)
            .await
            .map_err(AppError::Internal)?;

    if !ai_service.is_enabled() {
        return Err(AppError::Internal("AI service is disabled".to_string()));
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
        truncate_for_prompt(content, 3000)
    );

    let response = ai_service
        .chat(
            &[ChatMessage {
                role: ChatRole::User,
                content: prompt,
            }],
            Some(0.3),
            Some(500),
        )
        .await
        .map_err(AppError::Internal)?;

    let clean_content = response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let parsed: serde_json::Value = serde_json::from_str(clean_content).map_err(|error| {
        AppError::Internal(format!("Failed to parse AI JSON response: {}", error))
    })?;

    let sensitivity = match parsed
        .get("sensitivity")
        .and_then(|value| value.as_str())
        .unwrap_or("medium")
    {
        "high" => TimeSensitivity::High,
        "low" => TimeSensitivity::Low,
        _ => TimeSensitivity::Medium,
    };

    let reason = parsed
        .get("reason")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_string();
    let markers = parsed
        .get("markers")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(String::from))
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

    if let Err(error) = collection.insert_one(&new_capsule).await {
        tracing::error!("Failed to insert time capsule: {}", error);
    }

    Ok(result)
}

/// Analyze content time sensitivity and cache result.
pub async fn analyze_time_capsule(
    State(state): State<SharedState>,
    AppJson(payload): AppJson<TimeCapsuleRequest>,
) -> AppResult<Json<crate::models::ApiResponse<TimeCapsuleResult>>> {
    let collection = state.db.collection::<TimeCapsule>("time_capsules");
    let result = analyze_and_cache_time_capsule(
        &state,
        &collection,
        &payload.ref_id,
        &payload.ref_type,
        &payload.lang,
    )
    .await?;

    Ok(Json(crate::models::ApiResponse::success(result)))
}

/// Get cached time capsule analysis by ref ID.
pub async fn get_time_capsule(
    State(state): State<SharedState>,
    Path(ref_id): Path<String>,
    AppQuery(params): AppQuery<GetTimeCapsuleParams>,
) -> AppResult<Json<crate::models::ApiResponse<Option<TimeCapsuleResult>>>> {
    let collection = state.db.collection::<TimeCapsule>("time_capsules");
    let ref_type = params.ref_type.unwrap_or_else(|| "post".to_string());
    let lang = params.lang.unwrap_or_else(default_language_code);

    if let Some(cached) = load_cached_capsule(&collection, &ref_id, &ref_type, &lang).await? {
        let sensitivity = match cached.sensitivity.as_str() {
            "high" => TimeSensitivity::High,
            "low" => TimeSensitivity::Low,
            _ => TimeSensitivity::Medium,
        };

        return Ok(Json(crate::models::ApiResponse::success(Some(
            TimeCapsuleResult {
                sensitivity,
                reason: cached.reason,
                markers: cached.markers,
                is_new: false,
            },
        ))));
    }

    if AiService::from_database_for_usage(&state.db, state.http_client.clone(), AiUsage::Summary)
        .await
        .map(|service| !service.is_enabled())
        .unwrap_or(true)
    {
        return Ok(Json(crate::models::ApiResponse::success(None)));
    }

    let result =
        analyze_and_cache_time_capsule(&state, &collection, &ref_id, &ref_type, &lang).await?;

    Ok(Json(crate::models::ApiResponse::success(Some(result))))
}
