//! Outbound proxy probe for the admin settings page; never part of public site options.
use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::ApiResponse,
};
use axum::{
    Json,
    extract::State,
    http::header,
    response::IntoResponse,
};

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProxyTestRequest {
    pub proxy_url: String,
}

/// POST /api/options/networkOptions/test — probe the draft through the real outbound transport without saving.
#[utoipa::path(post, path = "/api/options/networkOptions/test", responses((status = 200, description = "Proxy probe result"), (status = 400, description = "Proxy configuration or connection failed")))]
pub async fn test_proxy(
    _state: State<SharedState>,
    _owner: OwnerOnly,
    AppJson(request): AppJson<ProxyTestRequest>,
) -> AppResult<impl IntoResponse> {
    // Mirror save-time validation so a successful test also means the setting can be enabled.
    crate::external::network::NetworkOptions {
        proxy_url: request.proxy_url.clone(),
    }
    .validate()
    .map(|_| ())
    .map_err(AppError::BadRequest)?;
    let result =
        crate::external::network::probe(&request.proxy_url, crate::external::network::PROBE_TARGET)
            .await
            .map_err(AppError::BadRequest)?;
    Ok((
        [(header::CACHE_CONTROL, "no-store, private")],
        Json(ApiResponse::success(serde_json::json!({
            "status": result.status,
            "latencyMs": result.latency_ms,
            "proxied": result.proxied,
        }))),
    ))
}
