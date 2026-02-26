use async_trait::async_trait;
use meilisearch_sdk::{
    errors::{Error, MeilisearchCommunicationError},
    request::{HttpClient, Method, parse_response},
    reqwest::ReaderStream,
};
use reqwest;
use serde::{Serialize, de::DeserializeOwned};

/// 将 reqwest (v0.13) 错误转换为 meilisearch-sdk 的 Error
///
/// meilisearch-sdk 内部依赖 reqwest v0.12，与项目直接依赖的 reqwest v0.13
/// 类型不兼容，因此无法通过 `From` trait 自动转换，需要手动桥接。
fn reqwest_err(e: reqwest::Error, url: &str) -> Error {
    Error::from(MeilisearchCommunicationError {
        status_code: e.status().map_or(0, |s| s.as_u16()),
        message: Some(e.to_string()),
        url: url.to_string(),
    })
}

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
        use reqwest::{ClientBuilder, header};

        let mut headers = header::HeaderMap::new();

        let ua = format!(
            "Meilisearch Rust (v{})",
            option_env!("CARGO_PKG_VERSION").unwrap_or("unknown")
        );
        if let Ok(val) = header::HeaderValue::from_str(&ua) {
            headers.insert(header::USER_AGENT, val);
        }

        if let Some(api_key) = api_key
            && let Ok(val) = header::HeaderValue::from_str(&format!("Bearer {api_key}"))
        {
            headers.insert(header::AUTHORIZATION, val);
        }

        let client = ClientBuilder::new()
            .default_headers(headers)
            .no_proxy()
            .build()
            .map_err(|e| reqwest_err(e, "<client-build>"))?;

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

        let response = self
            .client
            .execute(request.build().map_err(|e| reqwest_err(e, &url))?)
            .await
            .map_err(|e| reqwest_err(e, &url))?;
        let status = response.status().as_u16();
        let mut body = response.text().await.map_err(|e| reqwest_err(e, &url))?;

        if body.is_empty() {
            body = "null".to_string();
        }

        parse_response(status, expected_status_code, &body, url.clone())
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
