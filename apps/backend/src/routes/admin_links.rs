//! Admin link write routes (mounted under /links)

use crate::app::SharedState;
use crate::handlers::admin::links;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/", routing::post(links::create_link))
        .route("/admin", routing::get(links::list_links))
        .route("/health", routing::get(links::check_link_health))
        .route("/state", routing::get(links::link_state_count))
        .route(
            "/{id}/notification",
            routing::post(links::send_link_notification),
        )
        .route(
            "/{id}",
            routing::patch(links::update_link).delete(links::delete_link),
        )
}
