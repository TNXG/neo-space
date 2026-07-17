//! Owner-related public routes (used by admin login flow)

use crate::app::SharedState;
use crate::handlers;

/// `/owner` 路由组——挂在 `/api/owner/*` 下，用于 admin 登录前的能力探测。
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        .route(
            "/allow-login",
            axum::routing::get(handlers::owner::allow_login),
        )
        .route(
            "/identify",
            axum::routing::get(handlers::owner::identify_owner),
        )
}
