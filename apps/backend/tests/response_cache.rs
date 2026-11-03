//! HTTP-level regression coverage for public response caching.
#![allow(dead_code)]
#[path = "../src/error.rs"]
mod error;
#[path = "../src/services/response_cache.rs"]
pub mod response_cache;
mod services {
    pub use crate::response_cache;
}
#[path = "../src/middleware/response_cache.rs"]
mod response_cache_middleware;

use std::{sync::{Arc, atomic::{AtomicUsize, Ordering}}, time::Duration};
use axum::{Router, body::{Body, to_bytes}, extract::Request, http::{Method, StatusCode}, response::{IntoResponse, Response}, routing::get};
use response_cache::ResponseCache;
use tower::ServiceExt;

async fn content(request: Request, loads: Arc<AtomicUsize>) -> Response {
    let load = loads.fetch_add(1, Ordering::SeqCst) + 1;
    let query = request.uri().query().unwrap_or("");
    let mut response = format!("{query}:{load}").into_response();
    if query == "fail=1" { *response.status_mut() = StatusCode::INTERNAL_SERVER_ERROR; }
    if query == "cookie=1" { response.headers_mut().insert("set-cookie", "private=value".parse().unwrap()); }
    if query == "private=1" { response.headers_mut().insert("cache-control", "private".parse().unwrap()); }
    response
}

/// Build public and protected-shaped routes with the same changing content source.
fn router(loads: Arc<AtomicUsize>) -> Router {
    router_with_cache(loads, ResponseCache::default())
}

/// Mount the production middleware with a shared cache and test-specific expiration.
fn router_with_cache(loads: Arc<AtomicUsize>, cache: ResponseCache) -> Router {
    let load = move |request: Request| content(request, loads.clone());
    Router::new()
        .route("/api/posts", get(load.clone()).post(load.clone()))
        .route("/api/notes/admin/all", get(load))
        .layer(axum::middleware::from_fn_with_state(cache, response_cache_middleware::cache_response))
}

/// Execute a real Axum request and retain its observable response.
async fn request(router: &Router, uri: &str, method: Method, credential: Option<(&str, &str)>) -> (StatusCode, String) {
    let mut builder = Request::builder().uri(uri).method(method);
    if let Some((name, value)) = credential { builder = builder.header(name, value); }
    let response = router.clone().oneshot(builder.body(Body::empty()).unwrap()).await.unwrap();
    let status = response.status();
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    (status, String::from_utf8(body.to_vec()).unwrap())
}

#[tokio::test]
async fn repeated_public_reads_reuse_content_without_reloading() {
    let loads = Arc::new(AtomicUsize::new(0));
    let router = router(loads.clone());
    let first = request(&router, "/api/posts?lang=zh&page=1", Method::GET, None).await;
    let second = request(&router, "/api/posts?lang=zh&page=1", Method::GET, None).await;
    assert_eq!(first, (StatusCode::OK, "lang=zh&page=1:1".into()));
    assert_eq!(second, first, "identical anonymous reads must reuse the cached response");
    assert_eq!(loads.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn language_pagination_and_filters_keep_independent_responses() {
    let router = router(Arc::new(AtomicUsize::new(0)));
    for (uri, expected) in [
        ("/api/posts?lang=zh&page=1", "lang=zh&page=1:1"),
        ("/api/posts?lang=en&page=1", "lang=en&page=1:2"),
        ("/api/posts?lang=zh&page=2", "lang=zh&page=2:3"),
        ("/api/posts?lang=zh&page=1&category=rust", "lang=zh&page=1&category=rust:4"),
        ("/api/posts?lang=zh&page=1", "lang=zh&page=1:1"),
    ] {
        assert_eq!(request(&router, uri, Method::GET, None).await.1, expected);
    }
}

#[tokio::test]
async fn credentials_never_read_or_populate_the_anonymous_cache() {
    let router = router(Arc::new(AtomicUsize::new(0)));
    assert_eq!(request(&router, "/api/posts", Method::GET, None).await.1, ":1");
    assert_eq!(request(&router, "/api/posts", Method::GET, Some(("authorization", "Bearer owner"))).await.1, ":2");
    assert_eq!(request(&router, "/api/posts", Method::GET, Some(("cookie", "admin-auth-token=owner"))).await.1, ":3");
    assert_eq!(request(&router, "/api/posts", Method::GET, None).await.1, ":1");
    let fresh = router_with_cache(Arc::new(AtomicUsize::new(0)), ResponseCache::default());
    assert_eq!(request(&fresh, "/api/posts", Method::GET, Some(("authorization", "Bearer owner"))).await.1, ":1");
    assert_eq!(request(&fresh, "/api/posts", Method::GET, None).await.1, ":2");
}

#[tokio::test]
async fn management_routes_writes_errors_and_private_responses_are_not_cached() {
    for (uri, method) in [
        ("/api/notes/admin/all", Method::GET),
        ("/api/posts", Method::POST),
        ("/api/posts?fail=1", Method::GET),
        ("/api/posts?cookie=1", Method::GET),
        ("/api/posts?private=1", Method::GET),
    ] {
        let loads = Arc::new(AtomicUsize::new(0));
        let router = router(loads.clone());
        let first = request(&router, uri, method.clone(), None).await;
        let second = request(&router, uri, method, None).await;
        assert_ne!(first.1, second.1, "{uri} must reach the handler every time");
        assert_eq!(loads.load(Ordering::SeqCst), 2);
    }
}

#[tokio::test]
async fn ttl_and_idle_expiry_reload_changed_content() {
    for (ttl, idle) in [
        (Duration::from_millis(200), Duration::from_secs(60)),
        (Duration::from_secs(60), Duration::from_millis(200)),
    ] {
        let router = router_with_cache(Arc::new(AtomicUsize::new(0)), ResponseCache::new(ttl, idle));
        assert_eq!(request(&router, "/api/posts", Method::GET, None).await.1, ":1");
        assert_eq!(request(&router, "/api/posts", Method::GET, None).await.1, ":1");
        tokio::time::sleep(Duration::from_millis(350)).await;
        assert_eq!(request(&router, "/api/posts", Method::GET, None).await.1, ":2");
    }
}

#[tokio::test]
async fn invalidation_reloads_all_language_and_pagination_variants() {
    let cache = ResponseCache::default();
    let router = router_with_cache(Arc::new(AtomicUsize::new(0)), cache.clone());
    assert_eq!(request(&router, "/api/posts?lang=zh", Method::GET, None).await.1, "lang=zh:1");
    assert_eq!(request(&router, "/api/posts?lang=en&page=2", Method::GET, None).await.1, "lang=en&page=2:2");
    cache.invalidate_all();
    assert_eq!(request(&router, "/api/posts?lang=zh", Method::GET, None).await.1, "lang=zh:3");
    assert_eq!(request(&router, "/api/posts?lang=en&page=2", Method::GET, None).await.1, "lang=en&page=2:4");
}

#[tokio::test]
async fn in_flight_reads_cannot_repopulate_an_invalidated_generation() {
    let cache = ResponseCache::default();
    let loads = Arc::new(AtomicUsize::new(0));
    let started = Arc::new(tokio::sync::Notify::new());
    let finish = Arc::new(tokio::sync::Notify::new());
    let handler = {
        let (loads, started, finish) = (loads.clone(), started.clone(), finish.clone());
        move || {
            let (loads, started, finish) = (loads.clone(), started.clone(), finish.clone());
            async move {
                let version = loads.fetch_add(1, Ordering::SeqCst) + 1;
                if version == 1 { started.notify_one(); finish.notified().await; }
                format!("version:{version}")
            }
        }
    };
    let router = Router::new().route("/api/posts", get(handler))
        .layer(axum::middleware::from_fn_with_state(cache.clone(), response_cache_middleware::cache_response));
    let old = tokio::spawn({ let router = router.clone(); async move { request(&router, "/api/posts", Method::GET, None).await } });
    started.notified().await;
    cache.invalidate_all();
    assert_eq!(request(&router, "/api/posts", Method::GET, None).await.1, "version:2");
    finish.notify_one();
    assert_eq!(old.await.unwrap().1, "version:1");
    assert_eq!(request(&router, "/api/posts", Method::GET, None).await.1, "version:2");
}

#[tokio::test]
async fn nested_router_uses_the_original_api_url_and_public_route_template() {
    let loads = Arc::new(AtomicUsize::new(0));
    let load = move |request: Request| content(request, loads.clone());
    let api = Router::new().route("/posts", get(load))
        .layer(axum::middleware::from_fn_with_state(ResponseCache::default(), response_cache_middleware::cache_response));
    let router = Router::new().nest("/api", api);
    assert_eq!(request(&router, "/api/posts?lang=en", Method::GET, None).await.1, "lang=en:1");
    assert_eq!(request(&router, "/api/posts?lang=en", Method::GET, None).await.1, "lang=en:1");
}
