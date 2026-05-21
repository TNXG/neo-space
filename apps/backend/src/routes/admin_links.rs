//! Admin link write routes (mounted under /links)

use crate::app::SharedState;
use crate::handlers::admin::links;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/", routing::post(links::create_link))
        .route("/state", routing::get(links::link_state_count))
        .route(
            "/{id}",
            routing::patch(links::update_link).delete(links::delete_link),
        )
}
