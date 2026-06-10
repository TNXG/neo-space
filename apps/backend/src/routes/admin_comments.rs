//! Comment admin extension routes (mounted under /comments)

use crate::app::SharedState;
use crate::handlers::admin::comments_batch as cb;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/state", routing::patch(cb::batch_update_state))
        .route("/batch", routing::delete(cb::batch_delete))
        .route("/{id}/state", routing::patch(cb::update_state))
}
