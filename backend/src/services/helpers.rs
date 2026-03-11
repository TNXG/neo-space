//! Shared service helpers to avoid code duplication

use crate::app::SharedState;
use crate::models::AiSummary;
use crate::services::oauth::OAuthService;
use axum::http::HeaderMap;
use bson::doc;
use std::sync::Arc;

/// Create an OAuthService from shared application state.
/// Centralizes construction to avoid duplicating this in multiple handlers.
pub fn make_oauth_service(state: &SharedState) -> OAuthService {
    OAuthService::new(
        state.db.clone(),
        Arc::new(state.http_client.clone()),
        state.config.github_client_id.clone(),
        state.config.github_client_secret.clone(),
        state.config.backend_url.clone(),
        state.config.qq_app_id.clone(),
        state.config.qq_app_key.clone(),
    )
}

/// Fetch the latest AI summary for a given ref ID and language.
/// Falls back to any language if exact match not found (matches Rocket behavior).
pub async fn get_ai_summary(state: &SharedState, ref_id: &str, lang: &str) -> Option<String> {
    let ai_summaries_collection = state.db.collection::<AiSummary>("ai_summaries");

    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 })
        .build();

    // Try exact language match first
    if let Ok(Some(summary)) = ai_summaries_collection
        .find_one(doc! { "refId": ref_id, "lang": lang })
        .with_options(find_options.clone())
        .await
    {
        return Some(summary.summary);
    }

    // Fallback: any language for this ref
    ai_summaries_collection
        .find_one(doc! { "refId": ref_id })
        .with_options(find_options)
        .await
        .ok()
        .flatten()
        .map(|s| s.summary)
}

/// Verify Cloudflare Turnstile CAPTCHA token.
/// Extracted from comment handler for reuse and to populate external/captcha.rs.
pub async fn verify_turnstile(
    token: &str,
    secret: &str,
    http_client: &reqwest::Client,
) -> Result<(), ()> {
    let response = http_client
        .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .form(&[("secret", secret), ("response", token)])
        .send()
        .await
        .map_err(|_| ())?;

    let json: serde_json::Value = response.json().await.map_err(|_| ())?;

    if json
        .get("success")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        Ok(())
    } else {
        Err(())
    }
}

/// Extract client IP from request headers (X-Forwarded-For > X-Real-IP > CF-Connecting-IP)
pub fn extract_client_ip(headers: &HeaderMap) -> Option<String> {
    if let Some(xff) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok())
        && let Some(first_ip) = xff.split(',').next() {
            let ip = first_ip.trim().to_string();
            if !ip.is_empty() {
                return Some(ip);
            }
        }
    if let Some(real_ip) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        let ip = real_ip.trim().to_string();
        if !ip.is_empty() {
            return Some(ip);
        }
    }
    if let Some(cf_ip) = headers
        .get("cf-connecting-ip")
        .and_then(|v| v.to_str().ok())
    {
        let ip = cf_ip.trim().to_string();
        if !ip.is_empty() {
            return Some(ip);
        }
    }
    None
}
