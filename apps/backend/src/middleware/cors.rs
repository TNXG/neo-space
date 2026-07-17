//! CORS middleware using tower-http

use std::sync::Arc;

use arc_swap::ArcSwap;
use axum::http::{HeaderName, HeaderValue, request::Parts};
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::config::AppConfig;

/// Create CORS layer for the application
pub fn cors_layer(config: Arc<ArcSwap<AppConfig>>) -> CorsLayer {
    let allow_origin = AllowOrigin::predicate(move |origin: &HeaderValue, _request: &Parts| {
        const DEVELOPMENT_ORIGINS: &[&str] = &[
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:9528",
        ];
        let config = config.load();
        DEVELOPMENT_ORIGINS
            .iter()
            .any(|allowed| origin.as_bytes() == allowed.as_bytes())
            || origin.as_bytes() == config.frontend_url.as_bytes()
            || origin.as_bytes() == config.backend_url.as_bytes()
    });

    CorsLayer::new()
        .allow_origin(allow_origin)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            HeaderName::from_static("authorization"),
            HeaderName::from_static("content-type"),
            HeaderName::from_static("accept"),
            HeaderName::from_static("origin"),
            HeaderName::from_static("x-requested-with"),
            HeaderName::from_static("cache-control"),
            HeaderName::from_static("x-uuid"),
        ])
        .allow_credentials(true)
        .max_age(std::time::Duration::from_secs(3600))
}
