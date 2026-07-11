//! Link health check implementation details.

mod provider;
mod ssrf;

use std::time::Duration;

pub use provider::HostingProvider;
pub use ssrf::is_ssrf_url;

use self::provider::detect_hosting_provider;

fn elapsed_millis_u64(start: std::time::Instant) -> u64 {
    u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX)
}

/// Link health status.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LinkHealthStatus {
    pub link_id: String,
    pub url: String,
    pub is_alive: bool,
    pub status_code: Option<u16>,
    pub latency_ms: Option<u64>,
    pub hosting_provider: HostingProvider,
    pub checked_at: chrono::DateTime<chrono::Utc>,
    pub error_message: Option<String>,
}

/// Perform health check on a single link.
pub async fn perform_health_check(
    link: &serde_json::Value,
    http_client: &reqwest::Client,
    timeout_secs: u64,
) -> LinkHealthStatus {
    let start = std::time::Instant::now();

    let link_id = link
        .get("_id")
        .and_then(|value| {
            value.as_str().map(ToString::to_string).or_else(|| {
                value
                    .get("$oid")
                    .and_then(|oid| oid.as_str())
                    .map(ToString::to_string)
            })
        })
        .unwrap_or_else(|| "unknown".to_string());

    let url = link
        .get("url")
        .and_then(|value| value.as_str())
        .unwrap_or("http://unknown");

    if is_ssrf_url(url) {
        tracing::warn!("SSRF protection blocked URL: {}", url);
        return LinkHealthStatus {
            link_id,
            url: url.to_string(),
            is_alive: false,
            status_code: None,
            latency_ms: Some(0),
            hosting_provider: HostingProvider::Unknown,
            checked_at: chrono::Utc::now(),
            error_message: Some("Blocked: private/internal URL".to_string()),
        };
    }

    let user_agent = "Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0; +mailto:tnxg@outlook.jp; ) AppleWebKit/99 (KHTML, like Gecko) Chrome/99 MyGO/5 (KiraKira/DokiDoki; Bananice/Protected) Giraffe/4.11 (Wakarimasu/; Haruhikage/Stop)";

    match http_client
        .get(url)
        .header("User-Agent", user_agent)
        .timeout(Duration::from_secs(timeout_secs.clamp(1, 120)))
        .send()
        .await
    {
        Ok(response) => {
            let latency = elapsed_millis_u64(start);
            let status_code = response.status().as_u16();
            let is_alive = response.status().is_success() || response.status().is_redirection();
            let hosting_provider = detect_hosting_provider(&response);
            let provider_str = serde_json::to_value(&hosting_provider)
                .ok()
                .and_then(|value| value.as_str().map(ToString::to_string))
                .unwrap_or_else(|| "unknown".to_string());

            tracing::info!(
                "[LinkHealth] {} - 状态: {}, 延迟: {}ms, 服务商: {}",
                url,
                status_code,
                latency,
                provider_str
            );

            LinkHealthStatus {
                link_id,
                url: url.to_string(),
                is_alive,
                status_code: Some(status_code),
                latency_ms: Some(latency),
                hosting_provider,
                checked_at: chrono::Utc::now(),
                error_message: None,
            }
        }
        Err(error) => {
            let latency = elapsed_millis_u64(start);
            let error_msg = if error.is_timeout() {
                "Request timeout".to_string()
            } else if error.is_connect() {
                "Connection failed".to_string()
            } else {
                format!("Request failed: {error}")
            };

            tracing::warn!("[LinkHealth] {} - 失败: {}", url, error_msg);

            LinkHealthStatus {
                link_id,
                url: url.to_string(),
                is_alive: false,
                status_code: None,
                latency_ms: Some(latency),
                hosting_provider: HostingProvider::Unknown,
                checked_at: chrono::Utc::now(),
                error_message: Some(error_msg),
            }
        }
    }
}
