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
    sign_revalidation_request(&secret, &salt, tag, path, timestamp)
}

/// 使用与 Next.js Route Handler 一致的消息格式生成签名。
fn sign_revalidation_request(
    secret: &str,
    salt: &str,
    tag: &str,
    path: &str,
    timestamp: i64,
) -> Result<String, String> {
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
    let frontend_url = frontend_url.trim_end_matches('/');

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

    // 标签和路径使用同一个签名与请求，避免一次内容更新产生两次网络调用。
    let path_value = path.unwrap_or_default();
    let signature = match generate_signature(tag, path_value, timestamp) {
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
        path,
        timestamp,
        &signature,
    )
    .await
    {
        tracing::warn!(
            "Failed to revalidate tag {} and path {:?}: {}",
            tag,
            path,
            e
        );
    } else {
        tracing::info!(
            "ISR revalidation triggered for tag {} and path {:?}",
            tag,
            path
        );
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

    let response_body: serde_json::Value = response.json().await?;
    if response_body
        .get("revalidated")
        .and_then(serde_json::Value::as_bool)
        != Some(true)
    {
        return Err(
            format!("Revalidation endpoint returned an invalid response: {response_body}").into(),
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::sign_revalidation_request;

    /// 固定向量用于防止前后端签名字段顺序被单边修改。
    #[test]
    fn generates_frontend_compatible_signature() {
        let signature = sign_revalidation_request(
            "test-secret",
            "test-salt",
            "posts",
            "/posts/example",
            1_700_000_000,
        )
        .expect("signature should be generated");

        assert_eq!(
            signature,
            "b845d676e876f561a4f82171be865b288735b9d5cb1ac6a280a6fd4a4ded62c1"
        );
    }
}
