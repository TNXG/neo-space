//! 余下管理面板辅助 API：cron-task / backup / search-index / webhooks /
//! subscribe / token / dependencies / health-test / activity / analyze / pty。
//!
//! 这些功能 mx-admin 都有调用入口，但其后端尚未完全落地。
//! 当前实现为最小可用版本：返回空数据 / 接受请求并 ack。
//! 接口 URL 已稳定，后续替换为真实实现时无需调整 admin 端。

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
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
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".into()))
}

// ==================== cron-task ====================

#[derive(Debug, Serialize)]
pub struct CronDefinition {
    #[serde(rename = "type")]
    pub task_type: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "cronExpression")]
    pub cron_expression: String,
    #[serde(rename = "lastDate", skip_serializing_if = "Option::is_none")]
    pub last_date: Option<String>,
    #[serde(rename = "nextDate", skip_serializing_if = "Option::is_none")]
    pub next_date: Option<String>,
}

pub async fn list_cron_definitions(
    State(_state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<CronDefinition>>>> {
    let defs = vec![
        CronDefinition {
            task_type: "cron:link-health-check".into(),
            name: "友链健康检查".into(),
            description: "定时巡检友链状态".into(),
            cron_expression: "0 0 6 * * *".into(),
            last_date: None,
            next_date: None,
        },
        CronDefinition {
            task_type: "cron:rebuild-search-index".into(),
            name: "重建搜索索引".into(),
            description: "全量同步内容到 Meilisearch".into(),
            cron_expression: "0 0 4 * * *".into(),
            last_date: None,
            next_date: None,
        },
    ];
    Ok(Json(ApiResponse::success(defs)))
}

#[derive(Debug, Deserialize)]
pub struct TriggerCronRequest {
    #[serde(rename = "type")]
    pub task_type: String,
}

pub async fn trigger_cron_task(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<TriggerCronRequest>,
) -> AppResult<Json<ApiResponse<CronTaskRecord>>> {
    let id = ObjectId::new();
    let now = chrono::Utc::now().timestamp_millis();
    let doc = doc! {
        "_id": id,
        "type": &req.task_type,
        "status": "pending",
        "createdAt": now,
    };
    state
        .db
        .collection::<bson::Document>("cron_tasks")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let r = state
        .db
        .collection::<CronTaskRecord>("cron_tasks")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Cron task not created".into()))?;
    Ok(Json(ApiResponse::success(r)))
}

pub async fn list_cron_tasks(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<CronTaskRecord>>>> {
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(50)
        .build();
    let mut cursor = state
        .db
        .collection::<CronTaskRecord>("cron_tasks")
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(t) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(t);
    }
    Ok(Json(ApiResponse::success(items)))
}

// ==================== backups ====================

#[derive(Debug, Serialize)]
pub struct BackupItem {
    pub filename: String,
    pub size: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

pub async fn list_backups(_owner: OwnerOnly) -> AppResult<Json<ApiResponse<Vec<BackupItem>>>> {
    let dir = std::env::var("BACKUP_DIR").unwrap_or_else(|_| "./storage/backups".into());
    let mut items: Vec<BackupItem> = Vec::new();
    if let Ok(mut entries) = tokio::fs::read_dir(&dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let meta = match entry.metadata().await {
                Ok(m) => m,
                Err(_) => continue,
            };
            if !meta.is_file() {
                continue;
            }
            items.push(BackupItem {
                filename: entry.file_name().to_string_lossy().into_owned(),
                size: format!("{} B", meta.len()),
                created_at: chrono::Utc::now().to_rfc3339(),
            });
        }
    }
    Ok(Json(ApiResponse::success(items)))
}

// ==================== search-index ====================

#[derive(Debug, Serialize)]
pub struct SearchIndexStatus {
    pub running: bool,
    pub progress: i32,
    pub total: i32,
}

pub async fn rebuild_search_index(
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<SearchIndexStatus>>> {
    Ok(Json(ApiResponse::success(SearchIndexStatus {
        running: false,
        progress: 0,
        total: 0,
    })))
}

pub async fn search_index_status(
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<SearchIndexStatus>>> {
    Ok(Json(ApiResponse::success(SearchIndexStatus {
        running: false,
        progress: 0,
        total: 0,
    })))
}

// ==================== webhooks ====================

pub async fn list_webhooks(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<Webhook>>>> {
    let mut cursor = state
        .db
        .collection::<Webhook>("webhooks")
        .find(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(w) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(w);
    }
    Ok(Json(ApiResponse::success(items)))
}

#[derive(Debug, Deserialize)]
pub struct UpsertWebhookRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub events: Option<Vec<String>>,
    pub secret: Option<String>,
    pub enabled: Option<bool>,
}

pub async fn upsert_webhook(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<UpsertWebhookRequest>,
) -> AppResult<Json<ApiResponse<Webhook>>> {
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "name": req.name.unwrap_or_default(),
        "url": req.url.unwrap_or_default(),
        "events": req.events.unwrap_or_default(),
        "secret": req.secret,
        "enabled": req.enabled.unwrap_or(true),
        "created": bson::DateTime::now(),
    };
    state
        .db
        .collection::<bson::Document>("webhooks")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let w = state
        .db
        .collection::<Webhook>("webhooks")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Webhook insert failed".into()))?;
    Ok(Json(ApiResponse::success(w)))
}

pub async fn delete_webhook(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    state
        .db
        .collection::<Webhook>("webhooks")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}

// ==================== subscribe ====================

pub async fn list_subscribers(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<Subscriber>>>> {
    let mut cursor = state
        .db
        .collection::<Subscriber>("subscribers")
        .find(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(s) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(s);
    }
    Ok(Json(ApiResponse::success(items)))
}

// ==================== token ====================

pub async fn list_tokens(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<ApiToken>>>> {
    let mut cursor = state
        .db
        .collection::<ApiToken>("api_tokens")
        .find(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(t) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(t);
    }
    Ok(Json(ApiResponse::success(items)))
}

#[derive(Debug, Deserialize)]
pub struct CreateTokenRequest {
    pub name: String,
    pub expired: Option<String>,
}

pub async fn create_token(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateTokenRequest>,
) -> AppResult<Json<ApiResponse<ApiToken>>> {
    let id = ObjectId::new();
    let token_value = format!("tk_{}", uuid::Uuid::new_v4().simple());
    let mut doc = doc! {
        "_id": id,
        "name": req.name,
        "token": &token_value,
        "created": bson::DateTime::now(),
    };
    if let Some(exp) = req.expired {
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(&exp) {
            doc.insert("expired", bson::DateTime::from_chrono(dt.to_utc()));
        }
    }
    state
        .db
        .collection::<bson::Document>("api_tokens")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let t = state
        .db
        .collection::<ApiToken>("api_tokens")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("token insert failed".into()))?;
    Ok(Json(ApiResponse::success(t)))
}

pub async fn delete_token(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    state
        .db
        .collection::<ApiToken>("api_tokens")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}

// ==================== misc ack ====================

pub async fn empty_ok() -> AppResult<Json<ApiResponse<Value>>> {
    Ok(Json(ApiResponse::success(Value::Null)))
}

pub async fn empty_array() -> AppResult<Json<ApiResponse<Vec<Value>>>> {
    Ok(Json(ApiResponse::success(Vec::new())))
}
