//! ISR (Incremental Static Regeneration) revalidation for Next.js

use crate::app::SharedState;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::time::Duration;

type HmacSha256 = Hmac<Sha256>;

/// Generate HMAC-SHA256 signature for revalidation request
fn generate_signature(tag: &str, path: &str, timestamp: i64) -> Result<String, String> {
    let secret = std::env::var("REVALIDATION_SECRET")
        .map_err(|_| "REVALIDATION_SECRET not set".to_string())?;

    let salt = std::env::var("REVALIDATION_SALT").unwrap_or_else(|_| "default-salt".to_string());

    // Construct message: secret + timestamp + salt + tag + path
    let message = format!("{}{}{}{}{}", secret, timestamp, salt, tag, path);

    // Create HMAC-SHA256
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|e| format!("Failed to create HMAC: {}", e))?;

    mac.update(message.as_bytes());
    let result = mac.finalize();
    Ok(hex::encode(result.into_bytes()))
}

/// Trigger ISR revalidation for Next.js
pub(crate) async fn trigger_isr_revalidation(state: &SharedState, tag: &str, path: Option<&str>) {
    let frontend_url = state.config().frontend_url.clone();

    // Check if REVALIDATION_SECRET is configured
    if std::env::var("REVALIDATION_SECRET").is_err() {
        tracing::warn!("REVALIDATION_SECRET not configured, skipping ISR revalidation");
        return;
    }

    let timestamp = chrono::Utc::now().timestamp();
    let url = format!("{}/api/revalidate", frontend_url);
    tracing::info!(
        "Preparing ISR revalidation request: url={}, tag={}, path={:?}",
        url,
        tag,
        path
    );

    // Revalidate by tag
    let signature = match generate_signature(tag, "", timestamp) {
        Ok(sig) => sig,
        Err(e) => {
            tracing::error!("Failed to generate signature for tag: {}", e);
            return;
        }
    };

    if let Err(e) = send_revalidation_request(
        &state.http_client,
        &url,
        Some(tag),
        None,
        timestamp,
        &signature,
    )
    .await
    {
        tracing::warn!("Failed to revalidate tag {}: {}", tag, e);
    } else {
        tracing::info!("ISR revalidation triggered for tag: {}", tag);
    }

    // Revalidate specific path if provided
    if let Some(p) = path {
        let signature = match generate_signature("", p, timestamp) {
            Ok(sig) => sig,
            Err(e) => {
                tracing::error!("Failed to generate signature for path: {}", e);
                return;
            }
        };

        if let Err(e) = send_revalidation_request(
            &state.http_client,
            &url,
            None,
            Some(p),
            timestamp,
            &signature,
        )
        .await
        {
            tracing::warn!("Failed to revalidate path {}: {}", p, e);
        } else {
            tracing::info!("ISR revalidation triggered for path: {}", p);
        }
    }
}

/// Send revalidation request to Next.js with proper authentication
pub(crate) async fn send_revalidation_request(
    client: &reqwest::Client,
    url: &str,
    tag: Option<&str>,
    path: Option<&str>,
    timestamp: i64,
    signature: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let body = serde_json::json!({
        "tag": tag,
        "path": path,
        "timestamp": timestamp,
        "signature": signature,
    });

    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&body)
        .timeout(Duration::from_secs(10))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Revalidation failed: {} - {}", status, body).into());
    }

    Ok(())
}
