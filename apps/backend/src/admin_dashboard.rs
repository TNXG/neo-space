//! Embedded admin dashboard SPA serving.
//!
//! 将 `apps/admin` 的构建产物（`dist/`）以 [`rust-embed`] 打包进二进制，
//! 通过 Axum 路由暴露在配置好的挂载路径上。访问该路径下的请求会优先匹配
//! 静态资源，未命中时退回到 `index.html`，以支持 Vue Router 的前端路由。

use axum::{
    Router,
    body::Body,
    extract::Path,
    http::{HeaderValue, StatusCode, header},
    response::{IntoResponse, Response},
    routing::get,
};
use rust_embed::RustEmbed;

use crate::app::SharedState;

#[derive(RustEmbed)]
#[folder = "../admin/dist"]
struct AdminAssets;

/// 构建嵌入式 admin 控制面板的子路由。
///
/// 当配置中 `admin_dashboard_enabled = false` 时返回 `None`，调用方应跳过挂载。
pub fn router(state: &SharedState) -> Option<Router<SharedState>> {
    if !state.config.admin_dashboard_enabled {
        return None;
    }

    let mount = state.config.admin_dashboard_path.clone();
    tracing::info!("Admin 控制面板已启用，挂载于: {}", mount);

    Some(
        Router::new()
            .route("/", get(serve_index))
            .route("/{*path}", get(serve_asset)),
    )
}

async fn serve_index() -> Response {
    serve_embedded("index.html")
}

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

fn serve_embedded(path: &str) -> Response {
    let Some(file) = AdminAssets::get(path) else {
        return (StatusCode::NOT_FOUND, "admin asset not found").into_response();
    };

    let mime = mime_guess::from_path(path).first_or_octet_stream();
    let mut response = Response::new(Body::from(file.data.into_owned()));

    if let Ok(value) = HeaderValue::from_str(mime.as_ref()) {
        response.headers_mut().insert(header::CONTENT_TYPE, value);
    }

    // 入口 HTML 不缓存，便于发布新版本后立即生效
    let cache_value = if path == "index.html" {
        "no-cache, no-store, must-revalidate"
    } else {
        "public, max-age=31536000, immutable"
    };
    if let Ok(value) = HeaderValue::from_str(cache_value) {
        response.headers_mut().insert(header::CACHE_CONTROL, value);
    }

    response
}
