//! Link health check implementation details:
//! - Single-link health check
//! - Hosting provider detection
//! - SSRF protection

use std::time::Duration;

/// Hosting provider detector
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum HostingProvider {
    Vercel,
    Cloudflare,
    Netlify,
    GitHub,
    GitLab,
    DenoDeploy,
    Railway,
    Heroku,
    Render,
    Fly,
    #[serde(rename = "tencentedgeone")]
    TencentEdgeOne,
    #[serde(rename = "tencentedgeonepages")]
    TencentEdgeOnePages,
    #[serde(rename = "tencentcdn")]
    TencentCDN,
    Tencent,
    #[serde(rename = "aliyunesa")]
    AliyunESA,
    #[serde(rename = "aliyuncdn")]
    AliyunCDN,
    Aliyun,
    #[serde(rename = "aws")]
    Aws,
    Azure,
    #[serde(rename = "gcp")]
    Gcp,
    QuicCloud,
    OpenResty,
    Nginx,
    Caddy,
    Apache,
    LiteSpeed,
    #[default]
    Unknown,
}

/// Link health status
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

/// Perform health check on a single link
pub async fn perform_health_check(
    link: &serde_json::Value,
    http_client: &reqwest::Client,
) -> LinkHealthStatus {
    let start = std::time::Instant::now();

    // _id can be a plain string or Extended JSON { "$oid": "..." } when
    // the collection is typed as Collection<serde_json::Value>
    let link_id = link
        .get("_id")
        .and_then(|v| {
            v.as_str().map(|s| s.to_string()).or_else(|| {
                v.get("$oid")
                    .and_then(|o| o.as_str())
                    .map(|s| s.to_string())
            })
        })
        .and_then(|s| bson::oid::ObjectId::parse_str(&s).ok())
        .map(|id| id.to_hex())
        .unwrap_or_else(|| "unknown".to_string());

    let url = link
        .get("url")
        .and_then(|v| v.as_str())
        .unwrap_or("http://unknown");

    // SSRF protection: reject private/internal URLs
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
        .timeout(Duration::from_secs(10))
        .send()
        .await
    {
        Ok(response) => {
            let latency = start.elapsed().as_millis() as u64;
            let status_code = response.status().as_u16();
            let is_alive = response.status().is_success() || response.status().is_redirection();
            let hosting_provider = detect_hosting_provider(&response);

            let provider_str = serde_json::to_value(&hosting_provider)
                .ok()
                .and_then(|v| v.as_str().map(|s| s.to_string()))
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
        Err(e) => {
            let latency = start.elapsed().as_millis() as u64;
            let error_msg = if e.is_timeout() {
                "Request timeout".to_string()
            } else if e.is_connect() {
                "Connection failed".to_string()
            } else {
                format!("Request failed: {}", e)
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

/// Detect hosting provider from HTTP response
pub fn detect_hosting_provider(response: &reqwest::Response) -> HostingProvider {
    let headers = response.headers();

    // TencentEdgeOne Pages (checks before generic EdgeOne)
    if let Some(via) = headers.get("via")
        && via
            .to_str()
            .unwrap_or("")
            .to_lowercase()
            .contains("edgeone-pages")
    {
        return HostingProvider::TencentEdgeOnePages;
    }

    if headers.contains_key("x-vercel-id") || headers.contains_key("vercel-id") {
        return HostingProvider::Vercel;
    }
    if headers.contains_key("cf-ray") || headers.contains_key("cf-cache-status") {
        return HostingProvider::Cloudflare;
    }
    if headers.contains_key("x-nf-request-id") {
        return HostingProvider::Netlify;
    }
    if headers.contains_key("x-render-origin-server") {
        return HostingProvider::Render;
    }
    if let Some(via) = headers.get("via") {
        let via_str = via.to_str().unwrap_or("").to_lowercase();
        if via_str.contains("tencentedgeone") || via_str.contains("edgeone") {
            return HostingProvider::TencentEdgeOne;
        }
    }

    if let Some(server) = headers.get("server")
        && let Ok(value) = server.to_str()
    {
        if value.contains("GitHub") {
            return HostingProvider::GitHub;
        }
        if value.contains("GitLab") {
            return HostingProvider::GitLab;
        }
        if value.contains("Deno") {
            return HostingProvider::DenoDeploy;
        }
        if value.contains("openresty") || value.to_lowercase().contains("openresty") {
            return HostingProvider::OpenResty;
        }
        if value.to_lowercase().contains("tencentcos") || value.to_lowercase().contains("cos cdn") {
            return HostingProvider::TencentCDN;
        }
        if value.to_lowercase().contains("nginx") {
            return HostingProvider::Nginx;
        }
        if value.to_lowercase().contains("apache") {
            return HostingProvider::Apache;
        }
        if value.to_lowercase().contains("caddy") {
            return HostingProvider::Caddy;
        }
        if value.to_lowercase().contains("litespeed") || value.to_lowercase().contains("lsws") {
            return HostingProvider::LiteSpeed;
        }
        if value.to_lowercase().contains("quic.cloud") || value.to_lowercase().contains("quiccloud")
        {
            return HostingProvider::QuicCloud;
        }
    }

    // QuicCloud via `x-qc-*` headers
    if headers.keys().any(|k| k.as_str().starts_with("x-qc-")) {
        return HostingProvider::QuicCloud;
    }

    // TencentCDN via `x-cache` header
    if let Some(xcache) = headers.get("x-cache") {
        let val = xcache.to_str().unwrap_or("").to_lowercase();
        if val.contains("tencent") || val.contains("cdn") {
            return HostingProvider::TencentCDN;
        }
    }

    HostingProvider::Unknown
}

/// Check if a URL points to private/internal networks (SSRF protection)
pub fn is_ssrf_url(url: &str) -> bool {
    let url_lower = url.to_lowercase();

    // Block non-HTTP(S) schemes
    if !url_lower.starts_with("http://") && !url_lower.starts_with("https://") {
        return true;
    }

    // Extract host portion
    let host = url_lower
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split('/')
        .next()
        .unwrap_or("")
        .split(':')
        .next()
        .unwrap_or("");

    // Block localhost variants
    if host == "localhost" || host == "127.0.0.1" || host == "::1" || host == "[::1]" {
        return true;
    }

    // Block private IPv4 ranges
    if let Ok(addr) = host.parse::<std::net::Ipv4Addr>() {
        return addr.is_loopback()
            || addr.is_private()
            || addr.is_link_local()
            || addr.is_broadcast()
            || addr.is_documentation()
            || addr.is_unspecified();
    }

    // Block metadata service endpoints
    if host == "169.254.169.254" || host.ends_with(".local") {
        return true;
    }

    false
}
