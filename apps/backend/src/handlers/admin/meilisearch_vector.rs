//! 项目级 Meilisearch 向量配置管理接口。

use axum::{Json, extract::State};
use reqwest::Url;

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    external::meilisearch_admin::MeilisearchAdminClient,
    models::{
        ApiResponse, SearchVectorConfig, SearchVectorConfigResponse, UpdateSearchVectorConfig,
    },
    tasks::search_vector_config::{
        apply_vector_config_to_all_indexes, load_or_infer_vector_config, save_vector_config,
    },
};

/// 获取项目级向量配置，API Key 仅返回是否已配置。
pub async fn get_vector_config(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<SearchVectorConfigResponse>>> {
    let client = MeilisearchAdminClient::from_state(&state);
    let config = load_or_infer_vector_config(&state.db, &client).await?;
    Ok(Json(ApiResponse::success(
        SearchVectorConfigResponse::from(&config),
    )))
}

/// 保存项目级向量配置并同步到全部正式索引。
pub async fn update_vector_config(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<UpdateSearchVectorConfig>,
) -> AppResult<Json<ApiResponse<SearchVectorConfigResponse>>> {
    validate_payload(&payload)?;
    let client = MeilisearchAdminClient::from_state(&state);
    let current = load_or_infer_vector_config(&state.db, &client).await?;
    let api_key = if payload.clear_api_key {
        String::new()
    } else {
        payload
            .api_key
            .filter(|api_key| !api_key.trim().is_empty())
            .unwrap_or(current.api_key)
    };
    let config = SearchVectorConfig {
        configured: true,
        enabled: payload.enabled,
        api_url: payload.api_url.trim().to_string(),
        api_key,
        model: payload.model.trim().to_string(),
        dimensions: payload.dimensions,
        document_template_max_bytes: payload.document_template_max_bytes,
    };
    save_vector_config(&state.db, &config).await?;
    let applied_indexes = apply_vector_config_to_all_indexes(&client, &config).await?;
    tracing::info!(
        applied_indexes,
        enabled = config.enabled,
        "项目级向量配置已同步"
    );
    Ok(Json(ApiResponse::success(
        SearchVectorConfigResponse::from(&config),
    )))
}

/// 校验项目级向量配置，避免无效设置触发全索引任务。
fn validate_payload(payload: &UpdateSearchVectorConfig) -> AppResult<()> {
    if !(1..=65_536).contains(&payload.dimensions) {
        return Err(AppError::BadRequest(
            "向量维度必须在 1 到 65536 之间".to_string(),
        ));
    }
    if !(1..=10_000_000).contains(&payload.document_template_max_bytes) {
        return Err(AppError::BadRequest(
            "文档模板字节上限必须在 1 到 10000000 之间".to_string(),
        ));
    }
    if !payload.enabled {
        return Ok(());
    }
    if payload.model.trim().is_empty() {
        return Err(AppError::BadRequest("向量模型不能为空".to_string()));
    }
    let url = Url::parse(payload.api_url.trim())
        .map_err(|_| AppError::BadRequest("向量 API URL 无效".to_string()))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(AppError::BadRequest(
            "向量 API URL 仅支持 HTTP 或 HTTPS".to_string(),
        ));
    }
    Ok(())
}
