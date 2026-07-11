//! AI 内容翻译生成接口。

use axum::{Json, extract::State};
use bson::{DateTime, doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    external::ai::{AiService, AiUsage, ChatMessage, ChatRole},
    models::{AiTranslation, ApiResponse, Note, Page, Post, Recently},
};

#[derive(Debug, Deserialize)]
pub struct GenerateTranslationsRequest {
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(rename = "targetLanguages")]
    pub target_languages: Vec<String>,
}

#[derive(Debug)]
struct SourceContent {
    title: String,
    text: String,
    summary: Option<String>,
    tags: Vec<String>,
    modified: Option<DateTime>,
}

#[derive(Debug, Deserialize, Serialize)]
struct GeneratedTranslation {
    title: String,
    text: String,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    tags: Vec<String>,
}

fn normalize_ref_type(ref_type: &str) -> AppResult<&'static str> {
    match ref_type {
        "posts" | "post" | "Post" => Ok("posts"),
        "notes" | "note" | "Note" => Ok("notes"),
        "pages" | "page" | "Page" => Ok("pages"),
        "recently" | "Recently" => Ok("recently"),
        _ => Err(AppError::BadRequest(format!("Invalid refType: {ref_type}"))),
    }
}

async fn load_source(
    state: &SharedState,
    ref_id: &str,
    ref_type: &str,
) -> AppResult<SourceContent> {
    let object_id = ObjectId::parse_str(ref_id)
        .map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))?;

    match ref_type {
        "posts" => {
            let post = state
                .db
                .collection::<Post>("posts")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .ok_or_else(|| AppError::NotFound("Post not found".to_string()))?;
            Ok(SourceContent {
                title: post.title,
                text: post.text,
                summary: post.summary,
                tags: post.tags,
                modified: post.modified,
            })
        }
        "notes" => {
            let note = state
                .db
                .collection::<Note>("notes")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .ok_or_else(|| AppError::NotFound("Note not found".to_string()))?;
            Ok(SourceContent {
                title: note.title,
                text: note.text,
                summary: None,
                tags: Vec::new(),
                modified: note.modified,
            })
        }
        "pages" => {
            let page = state
                .db
                .collection::<Page>("pages")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .ok_or_else(|| AppError::NotFound("Page not found".to_string()))?;
            Ok(SourceContent {
                title: page.title,
                text: page.text,
                summary: page.subtitle,
                tags: Vec::new(),
                modified: page.modified,
            })
        }
        "recently" => {
            let recently = state
                .db
                .collection::<Recently>("recently")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .ok_or_else(|| AppError::NotFound("Recently not found".to_string()))?;
            Ok(SourceContent {
                title: recently.content.chars().take(40).collect(),
                text: recently.content,
                summary: None,
                tags: Vec::new(),
                modified: None,
            })
        }
        _ => Err(AppError::BadRequest("Invalid refType".to_string())),
    }
}

fn parse_generated_translation(response: &str) -> AppResult<GeneratedTranslation> {
    let clean_response = response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    serde_json::from_str(clean_response)
        .map_err(|error| AppError::Internal(format!("Invalid AI translation response: {error}")))
}

async fn translate(
    service: &AiService,
    source: &SourceContent,
    target_language: &str,
) -> AppResult<GeneratedTranslation> {
    let source_json = serde_json::json!({
        "title": source.title,
        "text": source.text,
        "summary": source.summary,
        "tags": source.tags,
    });
    let prompt = format!(
        "Translate the JSON content to language code '{target_language}'. Preserve Markdown, links, code blocks and meaning. Return only valid JSON with title, text, summary and tags fields. Do not add commentary.\n\n{source_json}"
    );
    let response = service
        .chat(
            &[ChatMessage {
                role: ChatRole::User,
                content: prompt,
            }],
            Some(0.2),
            None,
        )
        .await
        .map_err(AppError::Internal)?;
    parse_generated_translation(&response)
}

pub async fn generate_translations(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(request): AppJson<GenerateTranslationsRequest>,
) -> AppResult<Json<ApiResponse<Vec<AiTranslation>>>> {
    let ref_type = normalize_ref_type(&request.ref_type)?;
    let target_languages: Vec<String> = request
        .target_languages
        .into_iter()
        .map(|language| language.trim().to_lowercase())
        .filter(|language| !language.is_empty() && language != "zh")
        .collect();
    if target_languages.is_empty() {
        return Err(AppError::BadRequest(
            "targetLanguages must include a non-Chinese language".to_string(),
        ));
    }

    let source = load_source(&state, &request.ref_id, ref_type).await?;
    let service = AiService::from_database_for_usage(
        &state.db,
        state.http_client.clone(),
        AiUsage::Translation,
    )
    .await
    .map_err(AppError::Internal)?;
    if !service.is_enabled() {
        return Err(AppError::BadRequest(
            "AI translation is disabled".to_string(),
        ));
    }

    let mut hasher = Sha256::new();
    hasher.update(source.title.as_bytes());
    hasher.update(source.text.as_bytes());
    let hash = hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let collection = state.db.collection::<AiTranslation>("ai_translations");
    let mut translations = Vec::new();

    for language in target_languages {
        let generated = translate(&service, &source, &language).await?;
        let filter = doc! {
            "refId": &request.ref_id,
            "refType": ref_type,
            "lang": &language,
        };
        collection
            .update_one(
                filter.clone(),
                doc! { "$set": {
                    "hash": &hash,
                    "refId": &request.ref_id,
                    "refType": ref_type,
                    "lang": &language,
                    "sourceLang": "zh",
                    "title": generated.title,
                    "text": generated.text,
                    "summary": generated.summary,
                    "tags": generated.tags,
                    "sourceModified": source.modified,
                    "aiProvider": "configured",
                    "created": DateTime::now(),
                } },
            )
            .upsert(true)
            .await
            .map_err(|error| AppError::Database(error.to_string()))?;
        let translation = collection
            .find_one(filter)
            .await
            .map_err(|error| AppError::Database(error.to_string()))?
            .ok_or_else(|| AppError::Internal("Translation upsert failed".to_string()))?;
        translations.push(translation);
    }

    Ok(Json(ApiResponse::success(translations)))
}
