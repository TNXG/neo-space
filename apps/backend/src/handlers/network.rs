//! Server-to-server active transport configuration; never part of public site options.
use axum::{extract::State, http::{HeaderMap, header}, response::IntoResponse, Json};
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use crate::{app::SharedState, error::{AppError, AppResult}, models::ApiResponse};

fn authorize(headers: &HeaderMap, secret: &str, now: i64) -> AppResult<()> {
    if secret.is_empty() { return Err(AppError::Unauthorized); }
    let timestamp = headers.get("x-network-timestamp").and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<i64>().ok()).ok_or(AppError::Unauthorized)?;
    if now.abs_diff(timestamp) > 60 { return Err(AppError::Unauthorized); }
    let signature = headers.get("x-network-signature").and_then(|value| value.to_str().ok())
        .and_then(|value| hex::decode(value).ok()).ok_or(AppError::Unauthorized)?;
    let mut mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes()).map_err(|_| AppError::Unauthorized)?;
    mac.update(format!("network-config:{timestamp}").as_bytes());
    mac.verify_slice(&signature).map_err(|_| AppError::Unauthorized)
}

/// GET /api/internal/network — requires a short-lived, domain-separated shared-secret HMAC.
#[utoipa::path(get, path = "/api/internal/network", responses((status = 200, description = "Authenticated active server transport configuration"), (status = 401, description = "Missing or invalid internal signature")))]
pub async fn get_network_options(State(state): State<SharedState>, headers: HeaderMap) -> AppResult<impl IntoResponse> {
    let secret = std::env::var("REVALIDATION_SECRET").unwrap_or_default();
    authorize(&headers, &secret, chrono::Utc::now().timestamp())?;
    Ok(([(header::CACHE_CONTROL, "no-store, private")], Json(ApiResponse::success(serde_json::json!({
        "proxyUrl": state.network_options.proxy_url,
        "bypassOrigins": state.network_bypass_origins,
    })))))
}

/// Disclose only whether the ACTIVE startup transport proxies public traffic, never its URL.
#[utoipa::path(get, path = "/api/internal/network/status", responses((status = 200, description = "Credential-free active proxy status")))]
pub async fn get_network_status(State(state): State<SharedState>) -> impl IntoResponse {
    ([(header::CACHE_CONTROL, "no-store")], Json(ApiResponse::success(serde_json::json!({
        "proxyEnabled": !state.network_options.proxy_url.is_empty(),
    }))))
}

#[cfg(test)]
#[path = "../../tests/unit/network_auth.rs"]
mod tests;
