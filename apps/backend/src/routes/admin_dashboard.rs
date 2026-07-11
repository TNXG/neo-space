//! 管理后台仪表盘路由。

use crate::{app::SharedState, handlers::admin::dashboard};
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new().route(
        "/dashboard/overview",
        routing::get(dashboard::dashboard_overview),
    )
}
