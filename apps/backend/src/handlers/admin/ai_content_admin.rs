//! AI 写作辅助与摘要管理接口。

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

// ==================== AI Writer ====================

#[derive(Debug, Deserialize)]
pub struct WriterGenerateRequest {
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WriterGenerateResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
}

fn fallback_slug(input: &str) -> String {
    let lower = input.trim().to_lowercase();
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in lower.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    if out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        format!("draft-{}", chrono::Utc::now().timestamp())
    } else {
        out
    }
}

pub async fn writer_generate(
    State(_state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<WriterGenerateRequest>,
) -> AppResult<Json<ApiResponse<WriterGenerateResponse>>> {
    // 出于稳定性考虑，先返回基于规则的 fallback。
    // TODO(ai): 接入 OpenAI ChatCompletion 生成。
    let resp = match req.kind.as_str() {
        "slug" => {
            let title = req
                .title
                .ok_or_else(|| AppError::BadRequest("title 必填".into()))?;
            WriterGenerateResponse {
                title: None,
                slug: Some(fallback_slug(&title)),
            }
        }
        "title-slug" => {
            let text = req
                .text
                .ok_or_else(|| AppError::BadRequest("text 必填".into()))?;
            let title = text
                .lines()
                .next()
                .unwrap_or(&text)
                .chars()
                .take(40)
                .collect::<String>();
            let slug = fallback_slug(&title);
            WriterGenerateResponse {
                title: Some(title),
                slug: Some(slug),
            }
        }
        other => return Err(AppError::BadRequest(format!("不支持的 type: {}", other))),
    };
    Ok(Json(ApiResponse::success(resp)))
}

// ==================== AI Summaries（list） ====================

#[derive(Debug, Deserialize)]
pub struct SummaryListQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct SummaryListResponse {
    pub items: Vec<AiSummary>,
    pub pagination: Pagination,
}

pub async fn list_summaries(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(q): AppQuery<SummaryListQuery>,
) -> AppResult<Json<ApiResponse<SummaryListResponse>>> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 100);
    let collection = state.db.collection::<AiSummary>("ai_summaries");
    let total = collection
        .count_documents(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip((page - 1) * size)
        .limit(size as i64)
        .build();
    let mut cursor = collection
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(d);
    }
    let pagination = Pagination::new(total as i64, page as i64, size as i64);
    Ok(Json(ApiResponse::success(SummaryListResponse {
        items,
        pagination,
    })))
}

pub async fn delete_summary(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let r = state
        .db
        .collection::<AiSummary>("ai_summaries")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if r.deleted_count == 0 {
        return Err(AppError::NotFound("Summary not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}
