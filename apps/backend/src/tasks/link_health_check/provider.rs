fn header_to_lowercase(headers: &reqwest::header::HeaderMap, header_name: &str) -> Option<String> {
    headers
        .get(header_name)
        .and_then(|value| value.to_str().ok())
        .map(str::to_ascii_lowercase)
}

/// Hosting provider detector.
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

/// Detect hosting provider from HTTP response.
pub(super) fn detect_hosting_provider(response: &reqwest::Response) -> HostingProvider {
    let headers = response.headers();

    if let Some(via_value) = header_to_lowercase(headers, "via")
        && via_value.contains("edgeone-pages")
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
    if let Some(via_value) = header_to_lowercase(headers, "via")
        && (via_value.contains("tencentedgeone") || via_value.contains("edgeone"))
    {
        return HostingProvider::TencentEdgeOne;
    }

    if let Some(server) = headers.get("server")
        && let Ok(value) = server.to_str()
    {
        let server_lowercase = value.to_ascii_lowercase();

        if value.contains("GitHub") {
            return HostingProvider::GitHub;
        }
        if value.contains("GitLab") {
            return HostingProvider::GitLab;
        }
        if value.contains("Deno") {
            return HostingProvider::DenoDeploy;
        }
        if server_lowercase.contains("openresty") {
            return HostingProvider::OpenResty;
        }
        if server_lowercase.contains("tencentcos") || server_lowercase.contains("cos cdn") {
            return HostingProvider::TencentCDN;
        }
        if server_lowercase.contains("nginx") {
            return HostingProvider::Nginx;
        }
        if server_lowercase.contains("apache") {
            return HostingProvider::Apache;
        }
        if server_lowercase.contains("caddy") {
            return HostingProvider::Caddy;
        }
        if server_lowercase.contains("litespeed") || server_lowercase.contains("lsws") {
            return HostingProvider::LiteSpeed;
        }
        if server_lowercase.contains("quic.cloud") || server_lowercase.contains("quiccloud") {
            return HostingProvider::QuicCloud;
        }
    }

    if headers.keys().any(|key| key.as_str().starts_with("x-qc-")) {
        return HostingProvider::QuicCloud;
    }

    if let Some(cache_value) = header_to_lowercase(headers, "x-cache")
        && (cache_value.contains("tencent") || cache_value.contains("cdn"))
    {
        return HostingProvider::TencentCDN;
    }

    HostingProvider::Unknown
}
