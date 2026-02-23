use async_trait::async_trait;
use meilisearch_sdk::{
    errors::Error,
    reqwest::ReaderStream,
    request::{parse_response, HttpClient, Method},
};
use reqwest_meili as reqwest;
use serde::{de::DeserializeOwned, Serialize};

/// 禁用系统代理的 Meilisearch HTTP 客户端
///
/// meilisearch-sdk 默认使用的 reqwest 客户端会读取 `HTTP_PROXY`/`HTTPS_PROXY` 等
/// 系统环境变量。在配置了代理的服务器环境下，对内网 Meilisearch 的请求可能
/// 被错误地路由到代理，导致 `error sending request for url` 错误。
///
/// 此客户端通过 `reqwest::ClientBuilder::no_proxy()` 在构造时彻底禁用代理，
/// 确保所有 Meilisearch 请求都直连目标服务。
#[derive(Debug, Clone)]
pub struct NoProxyHttpClient {
    client: reqwest::Client,
}

impl NoProxyHttpClient {
    pub fn new(api_key: Option<&str>) -> Result<Self, Error> {
        use reqwest::{header, ClientBuilder};

        let mut headers = header::HeaderMap::new();

        let ua = format!(
            "Meilisearch Rust (v{})",
            option_env!("CARGO_PKG_VERSION").unwrap_or("unknown")
        );
        if let Ok(val) = header::HeaderValue::from_str(&ua) {
            headers.insert(header::USER_AGENT, val);
        }

        if let Some(api_key) = api_key {
            if let Ok(val) = header::HeaderValue::from_str(&format!("Bearer {api_key}")) {
                headers.insert(header::AUTHORIZATION, val);
            }
        }

        let client = ClientBuilder::new()
            .default_headers(headers)
            .no_proxy()
            .build()?;

        Ok(Self { client })
    }
}

#[async_trait]
impl HttpClient for NoProxyHttpClient {
    async fn stream_request<
        Query: Serialize + Send + Sync,
        Body: futures_io::AsyncRead + Send + Sync + 'static,
        Output: DeserializeOwned + 'static,
    >(
        &self,
        url: &str,
        method: Method<Query, Body>,
        content_type: &str,
        expected_status_code: u16,
    ) -> Result<Output, Error> {
        use reqwest::header;

        let query = method.query();
        let query = yaup::to_string(query)?;

        let url = if query.is_empty() {
            url.to_string()
        } else {
            format!("{url}{query}")
        };

        let mut request = self.client.request(to_method(&method), &url);

        if let Some(body) = method.into_body() {
            let stream = ReaderStream::new(body);
            let body = reqwest::Body::wrap_stream(stream);
            request = request
                .header(header::CONTENT_TYPE, content_type)
                .body(body);
        }

        let response = self.client.execute(request.build()?).await?;
        let status = response.status().as_u16();
        let mut body = response.text().await?;

        if body.is_empty() {
            body = "null".to_string();
        }

        parse_response(status, expected_status_code, &body, url.to_string())
    }

    fn is_tokio(&self) -> bool {
        true
    }
}

fn to_method<Q, B>(method: &Method<Q, B>) -> reqwest::Method {
    match method {
        Method::Get { .. } => reqwest::Method::GET,
        Method::Delete { .. } => reqwest::Method::DELETE,
        Method::Post { .. } => reqwest::Method::POST,
        Method::Put { .. } => reqwest::Method::PUT,
        Method::Patch { .. } => reqwest::Method::PATCH,
    }
}
