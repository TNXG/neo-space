//! Meilisearch 索引、文档、配置与原生任务管理接口。

use axum::{
    Json,
    extract::{Path, State},
};
use reqwest::Method;
use serde::Deserialize;
use serde_json::{Value, json};

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppQuery, AppResult},
    external::meilisearch_admin::MeilisearchAdminClient,
    models::ApiResponse,
};

/// 文档分页参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentQuery {
    pub offset: Option<u64>,
    pub limit: Option<u64>,
    pub filter: Option<String>,
}

/// Meilisearch 原生任务筛选参数。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskQuery {
    pub limit: Option<u64>,
    pub from: Option<u64>,
    pub statuses: Option<String>,
    pub types: Option<String>,
    pub index_uids: Option<String>,
}

/// 索引创建请求。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIndexRequest {
    pub uid: String,
    pub primary_key: Option<String>,
}

/// 返回服务健康、版本与索引统计概览。
pub async fn overview(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Value>>> {
    let client = MeilisearchAdminClient::from_state(&state);
    let health = client.request(Method::GET, "/health").await?;
    let version = client.request(Method::GET, "/version").await?;
    let stats = client.request(Method::GET, "/stats").await?;
    Ok(Json(ApiResponse::success(json!({
        "health": health,
        "version": version,
        "stats": stats,
    }))))
}

/// 获取全部索引（Meilisearch 中集合与索引为同一资源）。
pub async fn list_indexes(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Value>>> {
    proxy_get(&state, "/indexes?limit=1000").await
}

/// 创建索引。
pub async fn create_index(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<CreateIndexRequest>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&payload.uid)?;
    let body = json!({ "uid": payload.uid, "primaryKey": payload.primary_key });
    proxy_json(&state, Method::POST, "/indexes", &body).await
}

/// 删除指定索引。
pub async fn delete_index(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(index_uid): Path<String>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    let value = MeilisearchAdminClient::from_state(&state)
        .request(Method::DELETE, &format!("/indexes/{index_uid}"))
        .await?;
    Ok(Json(ApiResponse::success(value)))
}

/// 分页读取集合文档，可传入 Meilisearch filter 表达式。
pub async fn list_documents(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(index_uid): Path<String>,
    AppQuery(query): AppQuery<DocumentQuery>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    let mut path = format!(
        "/indexes/{index_uid}/documents?offset={}&limit={}",
        query.offset.unwrap_or(0),
        query.limit.unwrap_or(50).clamp(1, 1000),
    );
    if let Some(filter) = query.filter.filter(|filter| !filter.is_empty()) {
        path.push_str("&filter=");
        path.push_str(&urlencoding::encode(&filter));
    }
    proxy_get(&state, &path).await
}

/// 读取单个文档。
pub async fn get_document(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path((index_uid, document_id)): Path<(String, String)>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    proxy_get(
        &state,
        &format!(
            "/indexes/{index_uid}/documents/{}",
            urlencoding::encode(&document_id)
        ),
    )
    .await
}

/// 新增或更新一批文档。
pub async fn upsert_documents(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(index_uid): Path<String>,
    AppJson(documents): AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    let normalized = match documents {
        Value::Array(_) => documents,
        Value::Object(_) => Value::Array(vec![documents]),
        _ => {
            return Err(AppError::BadRequest(
                "文档必须是 JSON 对象或数组".to_string(),
            ));
        }
    };
    proxy_json(
        &state,
        Method::POST,
        &format!("/indexes/{index_uid}/documents"),
        &normalized,
    )
    .await
}

/// 删除单个文档。
pub async fn delete_document(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path((index_uid, document_id)): Path<(String, String)>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    let value = MeilisearchAdminClient::from_state(&state)
        .request(
            Method::DELETE,
            &format!(
                "/indexes/{index_uid}/documents/{}",
                urlencoding::encode(&document_id)
            ),
        )
        .await?;
    Ok(Json(ApiResponse::success(value)))
}

/// 导出集合文档；管理端负责保存为 JSON 文件。
pub async fn export_documents(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(index_uid): Path<String>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    let client = MeilisearchAdminClient::from_state(&state);
    let mut offset = 0_u64;
    let mut documents = Vec::new();
    loop {
        let page = client
            .request(
                Method::GET,
                &format!("/indexes/{index_uid}/documents?offset={offset}&limit=1000"),
            )
            .await?;
        let mut results = page
            .get("results")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let page_count = results.len();
        documents.append(&mut results);
        if page_count < 1000 {
            break;
        }
        offset += page_count as u64;
    }
    let total = documents.len();
    Ok(Json(ApiResponse::success(json!({
        "results": documents,
        "total": total,
        "offset": 0,
        "limit": total,
    }))))
}

/// 获取索引全部设置，包括 Embedders、同义词、停用词与排序规则。
pub async fn get_settings(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(index_uid): Path<String>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    proxy_get(&state, &format!("/indexes/{index_uid}/settings")).await
}

/// 合并更新索引设置；完整 JSON 透传以兼容未来 Meilisearch 参数。
pub async fn update_settings(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(index_uid): Path<String>,
    AppJson(settings): AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    validate_index_uid(&index_uid)?;
    proxy_json(
        &state,
        Method::PATCH,
        &format!("/indexes/{index_uid}/settings"),
        &settings,
    )
    .await
}

/// 查询 Meilisearch 原生异步任务队列。
pub async fn list_tasks(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(query): AppQuery<TaskQuery>,
) -> AppResult<Json<ApiResponse<Value>>> {
    let mut parameters = vec![format!("limit={}", query.limit.unwrap_or(50).clamp(1, 100))];
    if let Some(from) = query.from {
        parameters.push(format!("from={from}"));
    }
    if let Some(value) = query.statuses {
        parameters.push(format!("statuses={}", urlencoding::encode(&value)));
    }
    if let Some(value) = query.types {
        parameters.push(format!("types={}", urlencoding::encode(&value)));
    }
    if let Some(value) = query.index_uids {
        parameters.push(format!("indexUids={}", urlencoding::encode(&value)));
    }
    proxy_get(&state, &format!("/tasks?{}", parameters.join("&"))).await
}

/// 请求取消仍处于 queued/processing 的 Meilisearch 原生任务。
pub async fn cancel_tasks(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(filters): AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    let query = filters
        .get("uids")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if query.is_empty() {
        return Err(AppError::BadRequest(
            "必须提供以逗号分隔的 uids".to_string(),
        ));
    }
    proxy_json(
        &state,
        Method::POST,
        &format!("/tasks/cancel?uids={}", urlencoding::encode(query)),
        &json!({}),
    )
    .await
}

/// 代理 GET 并使用统一 API 包装。
async fn proxy_get(state: &SharedState, path: &str) -> AppResult<Json<ApiResponse<Value>>> {
    let value = MeilisearchAdminClient::from_state(state)
        .request(Method::GET, path)
        .await?;
    Ok(Json(ApiResponse::success(value)))
}

/// 代理 JSON 请求并使用统一 API 包装。
async fn proxy_json(
    state: &SharedState,
    method: Method,
    path: &str,
    body: &Value,
) -> AppResult<Json<ApiResponse<Value>>> {
    let value = MeilisearchAdminClient::from_state(state)
        .request_json(method, path, body)
        .await?;
    Ok(Json(ApiResponse::success(value)))
}

/// 索引 UID 只允许 Meilisearch 官方支持的安全字符，避免路径注入。
fn validate_index_uid(uid: &str) -> AppResult<()> {
    if uid.is_empty()
        || !uid.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        })
    {
        return Err(AppError::BadRequest(
            "索引 UID 仅允许字母、数字、连字符和下划线".to_string(),
        ));
    }
    Ok(())
}
