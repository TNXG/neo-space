//! Explicit server HTTP transport. Settings take effect after a backend restart.
//! `NETWORK_PROXY_URL` overrides the persisted proxy for this process without writing it back.
use bson::doc;
use mongodb::Database;
use reqwest::{Client, Url};
use serde::{Deserialize, Serialize};
use std::{
    net::IpAddr,
    time::{Duration, Instant},
};

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NetworkOptions {
    pub proxy_url: String,
}

/// SOCKS5 authenticates via RFC 1929 credentials read from the proxy URL, unlike HTTP CONNECT auth.
fn is_socks(url: &Url) -> bool {
    matches!(url.scheme(), "socks5" | "socks5h")
}

impl NetworkOptions {
    /// Validate without ever embedding the supplied URL or its credentials in errors.
    pub fn validate(&self) -> Result<Option<Url>, String> {
        if self.proxy_url.is_empty() {
            return Ok(None);
        }
        let invalid = || {
            "Proxy must be an HTTP, HTTPS, SOCKS5 or SOCKS5H origin URL (optional credentials, no path/query/fragment)".to_string()
        };
        let mut url = Url::parse(&self.proxy_url).map_err(|_| invalid())?;
        if !matches!(url.scheme(), "http" | "https" | "socks5" | "socks5h")
            || url.host_str().is_none()
            || !matches!(url.path(), "" | "/")
            || url.query().is_some()
            || url.fragment().is_some()
            || self.proxy_url.trim() != self.proxy_url
        {
            return Err(invalid());
        }
        for credential in [url.username(), url.password().unwrap_or_default()] {
            if credential
                .as_bytes()
                .iter()
                .enumerate()
                .any(|(index, byte)| {
                    *byte == b'%'
                        && (!credential
                            .as_bytes()
                            .get(index + 1)
                            .is_some_and(u8::is_ascii_hexdigit)
                            || !credential
                                .as_bytes()
                                .get(index + 2)
                                .is_some_and(u8::is_ascii_hexdigit))
                })
                || urlencoding::decode(credential).is_err()
            {
                return Err(invalid());
            }
        }
        if is_socks(&url) {
            // Both runtimes resolve SOCKS5 targets at the proxy, so socks5 is the same as socks5h.
            if url.scheme() == "socks5" {
                url.set_scheme("socks5h").map_err(|()| invalid())?;
            }
            // Next's SOCKS client only offers authentication when both parts are present.
            let has_username = !url.username().is_empty();
            let has_password = url.password().is_some_and(|password| !password.is_empty());
            if has_username != has_password {
                return Err("SOCKS5 credentials require both a username and a password".into());
            }
            // Normalize to the origin form and the conventional SOCKS port so every runtime agrees.
            url.set_path("/");
            if url.port().is_none() {
                url.set_port(Some(1080)).map_err(|()| invalid())?;
            }
        }
        reqwest::Proxy::all(url.clone()).map_err(|_| invalid())?;
        Ok(Some(url))
    }
}

/// `NETWORK_PROXY_URL` is a per-process deployment override with higher priority than the
/// persisted option; it is never written back to the shared options collection, so local
/// development and a deployment can share one database while using different proxies.
/// Unset or blank falls back to the database.
fn environment_proxy_url() -> Option<String> {
    std::env::var("NETWORK_PROXY_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
}

/// Missing options mean explicitly direct; malformed persisted options or database failures abort startup.
pub async fn load_options(database: &Database) -> Result<NetworkOptions, std::io::Error> {
    let options = match environment_proxy_url() {
        Some(proxy_url) => NetworkOptions { proxy_url },
        None => {
            let document = database
                .collection::<bson::Document>("options")
                .find_one(doc! { "name": "networkOptions" })
                .await
                .map_err(|_| {
                    std::io::Error::other("Unable to load outbound network configuration")
                })?;
            match document {
                None => NetworkOptions::default(),
                Some(document) => bson::from_bson(
                    document.get("value").cloned().unwrap_or(bson::Bson::Null),
                )
                .map_err(|_| std::io::Error::other("Invalid outbound network configuration"))?,
            }
        }
    };
    options
        .validate()
        .map(|_| ())
        .map_err(std::io::Error::other)?;
    Ok(options)
}

/// Bypass literal private/local addresses, local names, and the configured application origins.
/// DNS names are not resolved for bypass; public FQDNs still traverse the proxy even if DNS resolves privately.
pub fn bypass_proxy(url: &Url, origins: &[String]) -> bool {
    if origins
        .iter()
        .any(|origin| url.origin().ascii_serialization() == *origin)
    {
        return true;
    }
    let host = url.host_str().unwrap_or_default().trim_matches(['[', ']']);
    if let Ok(ip) = host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(ip) => {
                ip.is_loopback() || ip.is_private() || ip.is_link_local() || ip.is_unspecified()
            }
            IpAddr::V6(ip) => {
                ip.is_loopback()
                    || ip.is_unique_local()
                    || ip.is_unicast_link_local()
                    || ip.is_unspecified()
                    || ip.to_ipv4_mapped().is_some_and(|ip| {
                        ip.is_loopback()
                            || ip.is_private()
                            || ip.is_link_local()
                            || ip.is_unspecified()
                    })
            }
        };
    }
    !host.contains('.')
        || std::path::Path::new(host)
            .extension()
            .is_some_and(|extension| {
                extension.eq_ignore_ascii_case("localhost")
                    || extension.eq_ignore_ascii_case("local")
            })
}

/// Construct the only production reqwest transport; ambient `HTTP_PROXY/NO_PROXY` are intentionally ignored.
pub fn build_client(options: &NetworkOptions, origins: &[String]) -> Result<Client, String> {
    let proxy_url = options.validate()?;
    let mut builder = Client::builder().no_proxy().timeout(Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0; +mailto:tnxg@outlook.jp; ) AppleWebKit/99 (KHTML, like Gecko) Chrome/99 MyGO/5 (KiraKira/DokiDoki; Bananice/Protected) Giraffe/4.11 (Wakarimasu/; Haruhikage/Stop)");
    if let Some(mut proxy_url) = proxy_url {
        let username = urlencoding::decode(proxy_url.username())
            .map_err(|_| "Invalid proxy credentials")?
            .into_owned();
        let password = urlencoding::decode(proxy_url.password().unwrap_or_default())
            .map_err(|_| "Invalid proxy credentials")?
            .into_owned();
        let socks = is_socks(&proxy_url);
        if socks {
            // Keep the credentials in the URL: the SOCKS connector reads them from there.
            proxy_url
                .set_username(&username)
                .map_err(|()| "Invalid proxy credentials")?;
            proxy_url
                .set_password((!password.is_empty()).then_some(password.as_str()))
                .map_err(|()| "Invalid proxy credentials")?;
        } else {
            proxy_url
                .set_username("")
                .map_err(|()| "Invalid proxy origin")?;
            proxy_url
                .set_password(None)
                .map_err(|()| "Invalid proxy origin")?;
        }
        let origins = origins.to_vec();
        let mut proxy = reqwest::Proxy::custom(move |target| {
            (!bypass_proxy(target, &origins)).then(|| proxy_url.clone())
        });
        if !socks && (!username.is_empty() || !password.is_empty()) {
            proxy = proxy.basic_auth(&username, &password);
        }
        builder = builder.proxy(proxy);
    }
    builder
        .build()
        .map_err(|_| "Unable to initialize outbound HTTP transport".into())
}

/// 管理端测试固定访问该地址，代理测试不能变成任意 URL 探测。
pub const PROBE_TARGET: &str = "https://www.google.com/generate_204";
const PROBE_TIMEOUT: Duration = Duration::from_secs(12);

/// 后端代理探测结果；不回传代理地址与凭据。
#[derive(Debug)]
pub struct ProbeResult {
    pub status: u16,
    pub latency_ms: u64,
    pub proxied: bool,
}

/// 用真实出站传输访问固定目标；错误信息不得包含代理 URL 或凭据。
pub async fn probe(proxy_url: &str, target: &str) -> Result<ProbeResult, String> {
    let options = NetworkOptions {
        proxy_url: proxy_url.to_owned(),
    };
    let client = build_client(&options, &[])?;
    let started = Instant::now();
    let response = tokio::time::timeout(PROBE_TIMEOUT, client.get(target).send())
        .await
        .map_err(|_| "Proxy test timed out".to_string())?
        .map_err(|error| {
            if error.is_timeout() {
                "Proxy test timed out".to_string()
            } else if error.is_connect() {
                "Unable to connect to the proxy server".to_string()
            } else {
                "Proxy test request failed".to_string()
            }
        })?;
    let elapsed = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
    Ok(ProbeResult {
        status: response.status().as_u16(),
        latency_ms: elapsed,
        proxied: !proxy_url.is_empty(),
    })
}
