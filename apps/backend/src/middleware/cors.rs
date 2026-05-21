//! CORS middleware using tower-http

use axum::http::{HeaderName, HeaderValue};
use tower_http::cors::CorsLayer;

/// Create CORS layer for the application
pub fn cors_layer(frontend_url: &str, backend_url: &str) -> CorsLayer {
    let mut origins = vec![
        HeaderValue::from_static("http://localhost:3000"),
        HeaderValue::from_static("http://localhost:3001"),
        HeaderValue::from_static("http://localhost:9528"),
    ];

    if let Ok(origin) = frontend_url.parse::<HeaderValue>() {
        origins.push(origin);
    }
    if let Ok(origin) = backend_url.parse::<HeaderValue>() {
        origins.push(origin);
    }

    // Deduplicate
    origins.dedup();

    CorsLayer::new()
        .allow_origin(origins)
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
