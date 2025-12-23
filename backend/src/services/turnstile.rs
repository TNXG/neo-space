//! Cloudflare Turnstile 验证服务

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
struct TurnstileVerifyRequest {
    secret: String,
    response: String,
}

#[derive(Debug, Deserialize)]
struct TurnstileVerifyResponse {
    success: bool,
    #[serde(rename = "error-codes")]
    error_codes: Option<Vec<String>>,
}

/// 验证 Cloudflare Turnstile token
pub async fn verify_turnstile(token: &str, secret: &str) -> Result<bool, String> {
    let client = reqwest::Client::new();
    
    let request = TurnstileVerifyRequest {
        secret: secret.to_string(),
        response: token.to_string(),
    };

    match client
        .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .json(&request)
        .send()
        .await
    {
        Ok(response) => {
            match response.json::<TurnstileVerifyResponse>().await {
                Ok(result) => {
                    if result.success {
                        Ok(true)
                    } else {
                        let error_msg = result
                            .error_codes
                            .map(|codes| codes.join(", "))
                            .unwrap_or_else(|| "Unknown error".to_string());
                        log::warn!("Turnstile verification failed: {}", error_msg);
                        Ok(false)
                    }
                }
                Err(e) => {
                    log::error!("Failed to parse Turnstile response: {}", e);
                    Err("验证服务响应解析失败".to_string())
                }
            }
        }
        Err(e) => {
            log::error!("Failed to verify Turnstile token: {}", e);
            Err("验证服务请求失败".to_string())
        }
    }
}
