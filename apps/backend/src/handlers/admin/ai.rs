//! Admin AI: writer / summary list / agent conversations。
//!
//! Time-capsule 的实现仍位于 handlers/ai/service.rs。此处补齐 mx-admin AI 面板
//! 所需的余下接口：
//! - POST /ai/writer/generate     生成标题或 slug
//! - GET  /ai/summaries           AI 摘要列表（按引用分组）
//! - DELETE /ai/summaries/{id}    删除单条 AI 摘要
//! - GET  /ai/agent/conversations           列表
//! - POST /ai/agent/conversations           新建
//! - GET  /ai/agent/conversations/{id}      详情
//! - PATCH /ai/agent/conversations/{id}/messages 增量追加消息
//! - PUT  /ai/agent/conversations/{id}/messages  全量替换消息
//! - PATCH /ai/agent/conversations/{id}     更新元信息（title/diff/review）
//! - DELETE /ai/agent/conversations/{id}    删除会话

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
use serde_json::Value;

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

// ==================== AI Agent Conversations ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentConversation {
    #[serde(rename = "_id", skip_serializing)]
    pub _id: Option<ObjectId>,
    pub id: String,
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub model: String,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    #[serde(default)]
    pub messages: Vec<Value>,
    #[serde(rename = "messageCount", default)]
    pub message_count: i64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "reviewState", skip_serializing_if = "Option::is_none")]
    pub review_state: Option<Value>,
    #[serde(rename = "diffState", skip_serializing_if = "Option::is_none")]
    pub diff_state: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    pub model: String,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub title: Option<String>,
    #[serde(default)]
    pub messages: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub struct ListConversationsQuery {
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConversationMetaRequest {
    pub title: Option<String>,
    #[serde(rename = "reviewState")]
    pub review_state: Option<Value>,
    #[serde(rename = "diffState")]
    pub diff_state: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct MessagesPayload {
    pub messages: Vec<Value>,
}

pub async fn list_conversations(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(q): AppQuery<ListConversationsQuery>,
) -> AppResult<Json<ApiResponse<Vec<AgentConversation>>>> {
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "updatedAt": -1 })
        .build();
    let mut cursor = state
        .db
        .collection::<AgentConversation>("ai_agent_conversations")
        .find(doc! { "refId": &q.ref_id, "refType": &q.ref_type })
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(c) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(c);
    }
    Ok(Json(ApiResponse::success(items)))
}

pub async fn create_conversation(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateConversationRequest>,
) -> AppResult<Json<ApiResponse<AgentConversation>>> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let conv = AgentConversation {
        _id: Some(ObjectId::new()),
        id: id.clone(),
        ref_id: req.ref_id,
        ref_type: req.ref_type,
        title: req.title,
        model: req.model,
        provider_id: req.provider_id,
        message_count: req.messages.len() as i64,
        messages: req.messages,
        created_at: now.clone(),
        updated_at: now,
        review_state: None,
        diff_state: None,
    };
    state
        .db
        .collection::<AgentConversation>("ai_agent_conversations")
        .insert_one(&conv)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(conv)))
}

pub async fn get_conversation(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<AgentConversation>>> {
    let c = state
        .db
        .collection::<AgentConversation>("ai_agent_conversations")
        .find_one(doc! { "id": &id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Conversation not found".into()))?;
    Ok(Json(ApiResponse::success(c)))
}

pub async fn append_messages(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(payload): AppJson<MessagesPayload>,
) -> AppResult<Json<ApiResponse<()>>> {
    let messages_bson: Vec<bson::Bson> = payload
        .messages
        .into_iter()
        .map(|v| bson::to_bson(&v).unwrap_or(bson::Bson::Null))
        .collect();
    let now = chrono::Utc::now().to_rfc3339();
    state
        .db
        .collection::<AgentConversation>("ai_agent_conversations")
        .update_one(
            doc! { "id": &id },
            doc! {
                "$push": { "messages": { "$each": &messages_bson } },
                "$inc": { "messageCount": messages_bson.len() as i64 },
                "$set": { "updatedAt": now },
            },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}

pub async fn replace_messages(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(payload): AppJson<MessagesPayload>,
) -> AppResult<Json<ApiResponse<()>>> {
    let bson_msgs = bson::to_bson(&payload.messages)
        .map_err(|e| AppError::Internal(format!("bson encode: {}", e)))?;
    let count = payload.messages.len() as i64;
    let now = chrono::Utc::now().to_rfc3339();
    state
        .db
        .collection::<AgentConversation>("ai_agent_conversations")
        .update_one(
            doc! { "id": &id },
            doc! {
                "$set": {
                    "messages": bson_msgs,
                    "messageCount": count,
                    "updatedAt": now,
                }
            },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}

pub async fn update_conversation(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdateConversationMetaRequest>,
) -> AppResult<Json<ApiResponse<()>>> {
    let mut set_doc = doc! { "updatedAt": chrono::Utc::now().to_rfc3339() };
    if let Some(t) = req.title {
        set_doc.insert("title", t);
    }
    if let Some(r) = req.review_state {
        set_doc.insert("reviewState", bson::to_bson(&r).unwrap_or(bson::Bson::Null));
    }
    if let Some(d) = req.diff_state {
        set_doc.insert("diffState", bson::to_bson(&d).unwrap_or(bson::Bson::Null));
    }
    state
        .db
        .collection::<AgentConversation>("ai_agent_conversations")
        .update_one(doc! { "id": &id }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}

pub async fn delete_conversation(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let r = state
        .db
        .collection::<AgentConversation>("ai_agent_conversations")
        .delete_one(doc! { "id": &id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if r.deleted_count == 0 {
        return Err(AppError::NotFound("Conversation not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}
