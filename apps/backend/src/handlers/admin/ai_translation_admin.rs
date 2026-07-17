//! AI 翻译记录的查询、编辑与删除接口。

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
    tasks::content_change::notify_translation_changed,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{Regex, doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

// ==================== AI Translations ====================

#[derive(Debug, Deserialize)]
pub struct TranslationListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TranslationRefQuery {
    #[serde(rename = "refType")]
    pub ref_type: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TranslationArticle {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "type")]
    pub ref_type: String,
    pub title: String,
}

#[derive(Debug, Serialize)]
pub struct GroupedTranslationData {
    pub article: TranslationArticle,
    pub translations: Vec<AiTranslation>,
}

#[derive(Debug, Serialize)]
pub struct GroupedTranslationResponse {
    pub items: Vec<GroupedTranslationData>,
    pub pagination: Pagination,
}

#[derive(Debug, Serialize)]
pub struct TranslationByRefResponse {
    pub translations: Vec<AiTranslation>,
    pub article: Option<TranslationArticle>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTranslationRequest {
    pub title: Option<String>,
    pub text: Option<String>,
    pub summary: Option<String>,
    pub tags: Option<Vec<String>>,
}

fn translation_ref_type_filter(ref_type: Option<&str>) -> AppResult<Option<&'static str>> {
    match ref_type {
        None => Ok(None),
        Some("posts" | "post" | "Post") => Ok(Some("posts")),
        Some("notes" | "note" | "Note") => Ok(Some("notes")),
        Some("pages" | "page" | "Page") => Ok(Some("pages")),
        Some("recently" | "Recently") => Ok(Some("recently")),
        Some(other) => Err(AppError::BadRequest(format!("Invalid refType: {other}"))),
    }
}

fn escape_mongo_regex(input: &str) -> String {
    let mut escaped = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(
            ch,
            '\\' | '.' | '+' | '*' | '?' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '^' | '$'
        ) {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}

async fn load_translation_article(
    state: &SharedState,
    ref_id: &str,
    ref_type: &str,
) -> AppResult<Option<TranslationArticle>> {
    let object_id = match ObjectId::parse_str(ref_id) {
        Ok(object_id) => object_id,
        Err(_) => return Ok(None),
    };

    match ref_type {
        "posts" => {
            let article = state
                .db
                .collection::<Post>("posts")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(article.map(|post| TranslationArticle {
                id: post.id.to_hex(),
                ref_type: "posts".to_string(),
                title: post.title,
            }))
        }
        "notes" => {
            let article = state
                .db
                .collection::<Note>("notes")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(article.map(|note| TranslationArticle {
                id: note.id.to_hex(),
                ref_type: "notes".to_string(),
                title: note.title,
            }))
        }
        "pages" => {
            let article = state
                .db
                .collection::<Page>("pages")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(article.map(|page| TranslationArticle {
                id: page.id.to_hex(),
                ref_type: "pages".to_string(),
                title: page.title,
            }))
        }
        "recently" => {
            let article = state
                .db
                .collection::<Recently>("recently")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|e| AppError::Database(e.to_string()))?;
            Ok(article.map(|recently| TranslationArticle {
                id: recently.id.to_hex(),
                ref_type: "recently".to_string(),
                title: recently.content.chars().take(40).collect(),
            }))
        }
        _ => Ok(None),
    }
}

fn fallback_translation_article(translation: &AiTranslation) -> TranslationArticle {
    TranslationArticle {
        id: translation.ref_id.clone(),
        ref_type: translation.ref_type.clone(),
        title: translation
            .title
            .clone()
            .unwrap_or_else(|| translation.ref_id.clone()),
    }
}

pub async fn list_translations_grouped(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(q): AppQuery<TranslationListQuery>,
) -> AppResult<Json<ApiResponse<GroupedTranslationResponse>>> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 100);
    let collection = state.db.collection::<AiTranslation>("ai_translations");

    let mut filter = doc! {};
    if let Some(search) = q.search.as_deref().filter(|value| !value.trim().is_empty()) {
        let pattern = escape_mongo_regex(search.trim());
        filter.insert(
            "$or",
            vec![
                doc! { "title": { "$regex": Regex { pattern: pattern.clone(), options: "i".to_string() } } },
                doc! { "text": { "$regex": Regex { pattern: pattern.clone(), options: "i".to_string() } } },
                doc! { "summary": { "$regex": Regex { pattern, options: "i".to_string() } } },
            ],
        );
    }

    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    let mut cursor = collection
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut groups: Vec<GroupedTranslationData> = Vec::new();
    while let Some(translation) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        let group_index = groups.iter().position(|group| {
            group.article.id == translation.ref_id && group.article.ref_type == translation.ref_type
        });

        match group_index {
            Some(index) => {
                if let Some(group) = groups.get_mut(index) {
                    group.translations.push(translation);
                }
            }
            None => {
                let article =
                    load_translation_article(&state, &translation.ref_id, &translation.ref_type)
                        .await?
                        .unwrap_or_else(|| fallback_translation_article(&translation));
                groups.push(GroupedTranslationData {
                    article,
                    translations: vec![translation],
                });
            }
        }
    }

    let total = groups.len() as i64;
    let items = groups
        .into_iter()
        .skip(((page - 1) * size) as usize)
        .take(size as usize)
        .collect();

    Ok(Json(ApiResponse::success(GroupedTranslationResponse {
        items,
        pagination: Pagination::new(total, page as i64, size as i64),
    })))
}

pub async fn get_translations_by_ref(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(ref_id): Path<String>,
    AppQuery(q): AppQuery<TranslationRefQuery>,
) -> AppResult<Json<ApiResponse<TranslationByRefResponse>>> {
    let collection = state.db.collection::<AiTranslation>("ai_translations");
    let mut filter = doc! { "refId": &ref_id };
    if let Some(ref_type) = translation_ref_type_filter(q.ref_type.as_deref())? {
        filter.insert("refType", ref_type);
    }

    let mut cursor = collection
        .find(filter)
        .with_options(
            mongodb::options::FindOptions::builder()
                .sort(doc! { "created": -1 })
                .build(),
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut translations = Vec::new();
    while let Some(translation) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        translations.push(translation);
    }

    let article = if let Some(first) = translations.first() {
        load_translation_article(&state, &first.ref_id, &first.ref_type)
            .await?
            .or_else(|| Some(fallback_translation_article(first)))
    } else {
        None
    };

    Ok(Json(ApiResponse::success(TranslationByRefResponse {
        translations,
        article,
    })))
}

pub async fn update_translation(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdateTranslationRequest>,
) -> AppResult<Json<ApiResponse<AiTranslation>>> {
    let oid = parse_oid(&id)?;
    let mut set_doc = doc! {};

    if let Some(title) = req.title {
        set_doc.insert("title", title);
    }
    if let Some(text) = req.text {
        set_doc.insert("text", text);
    }
    if let Some(summary) = req.summary {
        set_doc.insert("summary", summary);
    }
    if let Some(tags) = req.tags {
        set_doc.insert("tags", tags);
    }

    if set_doc.is_empty() {
        return Err(AppError::BadRequest(
            "No translation fields to update".to_string(),
        ));
    }

    let collection = state.db.collection::<AiTranslation>("ai_translations");
    collection
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let translation = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Translation not found".to_string()))?;

    notify_translation_changed(&state, &translation).await;
    Ok(Json(ApiResponse::success(translation)))
}

pub async fn delete_translation(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let collection = state.db.collection::<AiTranslation>("ai_translations");
    let translation = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or_else(|| AppError::NotFound("Translation not found".to_string()))?;
    let result = collection
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Translation not found".to_string()));
    }
    notify_translation_changed(&state, &translation).await;
    Ok(Json(ApiResponse::success(())))
}
