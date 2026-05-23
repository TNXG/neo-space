//! Embedded admin dashboard SPA serving.
//!
//! 将 `apps/admin` 的构建产物（`dist/`）以 [`rust-embed`] 打包进二进制，
//! 通过 Axum 路由暴露在配置好的挂载路径上。访问该路径下的请求会优先匹配
//! 静态资源，未命中时退回到 `index.html`，以支持 Vue Router 的前端路由。

#[cfg(debug_assertions)]
use axum::http::Uri;
use axum::{
    Router,
    body::Body,
    extract::Path,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};

#[cfg(not(debug_assertions))]
use rust_embed::RustEmbed;

use crate::app::SharedState;

pub const ADMIN_DASHBOARD_PROXY_PATH: &str = "/proxy";

#[cfg(debug_assertions)]
const ADMIN_DEV_ORIGIN: &str = "http://localhost:9528";

#[cfg(not(debug_assertions))]
#[derive(RustEmbed)]
#[folder = "../admin/dist"]
struct AdminAssets;

/// 构建嵌入式 admin 控制面板的子路由。
///
/// 当配置中 `admin_dashboard_enabled = false` 时返回 `None`，调用方应跳过挂载。
pub fn mounted_router(state: &SharedState) -> Option<Router<SharedState>> {
    if !state.config.admin_dashboard_enabled {
        return None;
    }

    #[cfg(debug_assertions)]
    tracing::info!(
        "Admin 控制面板已启用，开发模式使用 {} 反代至 {}",
        ADMIN_DASHBOARD_PROXY_PATH,
        ADMIN_DEV_ORIGIN
    );

    #[cfg(not(debug_assertions))]
    tracing::info!(
        "Admin 控制面板已启用，挂载于: {}，生产模式使用内嵌 dist",
        ADMIN_DASHBOARD_PROXY_PATH
    );

    Some(
        Router::new()
            .route(ADMIN_DASHBOARD_PROXY_PATH, get(serve_index))
            .route(&format!("{ADMIN_DASHBOARD_PROXY_PATH}/"), get(serve_index))
            .route(
                &format!("{ADMIN_DASHBOARD_PROXY_PATH}/{{*path}}"),
                get(serve_asset),
            ),
    )
}

#[cfg(debug_assertions)]
async fn serve_index(uri: Uri) -> Response {
    proxy_admin_dev(String::new(), uri).await
}

#[cfg(not(debug_assertions))]
async fn serve_index() -> Response {
    serve_embedded("index.html")
}

#[cfg(debug_assertions)]
async fn serve_asset(Path(path): Path<String>, uri: Uri) -> Response {
    proxy_admin_dev(path, uri).await
}

#[cfg(not(debug_assertions))]
async fn serve_asset(Path(path): Path<String>) -> Response {
    let raw = path.trim_start_matches('/');
    if raw.is_empty() {
        return serve_embedded("index.html");
    }

    if AdminAssets::get(raw).is_some() {
        return serve_embedded(raw);
    }

    // SPA history fallback：未命中静态资源时返回入口 HTML
    serve_embedded("index.html")
}

#[cfg(debug_assertions)]
async fn proxy_admin_dev(path: String, uri: Uri) -> Response {
    let raw = path.trim_start_matches('/');
    let mut target = if raw.is_empty() {
        format!("{ADMIN_DEV_ORIGIN}{ADMIN_DASHBOARD_PROXY_PATH}/")
    } else {
        format!("{ADMIN_DEV_ORIGIN}{ADMIN_DASHBOARD_PROXY_PATH}/{raw}")
    };

    if let Some(query) = uri.query() {
        target.push('?');
        target.push_str(query);
    }

    let response = match reqwest::get(&target).await {
        Ok(response) => response,
        Err(error) => {
            tracing::warn!("Admin dev proxy request failed: {error}");
            return (
                StatusCode::BAD_GATEWAY,
                format!("admin dev server unavailable: {ADMIN_DEV_ORIGIN}"),
            )
                .into_response();
        }
    };

    let status =
        StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = response.headers().get(header::CONTENT_TYPE).cloned();
    let body = match response.bytes().await {
        Ok(bytes) => Body::from(bytes),
        Err(error) => {
            tracing::warn!("Admin dev proxy body read failed: {error}");
            return (StatusCode::BAD_GATEWAY, "admin dev proxy response failed").into_response();
        }
    };
    let mut proxied = Response::new(body);
    *proxied.status_mut() = status;
    if let Some(value) = content_type {
        proxied.headers_mut().insert(header::CONTENT_TYPE, value);
    }

    proxied
}

#[cfg(not(debug_assertions))]
fn serve_embedded(path: &str) -> Response {
    let Some(file) = AdminAssets::get(path) else {
        return (StatusCode::NOT_FOUND, "admin asset not found").into_response();
    };

    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let mut response = Response::new(Body::from(file.data.into_owned()));

    if let Ok(value) = mime.as_ref().parse() {
        response.headers_mut().insert(header::CONTENT_TYPE, value);
    }

    // 入口 HTML 不缓存，便于发布新版本后立即生效
    let cache_value = if path == "index.html" {
        "no-cache, no-store, must-revalidate"
    } else {
        "public, max-age=31536000, immutable"
    };
    if let Ok(value) = cache_value.parse() {
        response.headers_mut().insert(header::CACHE_CONTROL, value);
    }

    response
}
