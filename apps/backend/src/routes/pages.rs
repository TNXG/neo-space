//! Pages routes (public list/get + owner write)
//!
//! 公共 GET /pages/{slug} 留在 misc 路由（与既有前端兼容），
//! 这里仅暴露管理后台所需路径，避免与 {slug} 形参冲突。

use crate::app::SharedState;
use crate::handlers::admin::pages;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/list", routing::get(pages::list_pages))
        .route("/", routing::post(pages::create_page))
        .route("/id/{id}", routing::get(pages::get_page_by_id))
        .route(
            "/id/{id}",
            routing::put(pages::update_page).delete(pages::delete_page),
        )
}
