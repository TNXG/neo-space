//! Options KV routes

use crate::app::SharedState;
use crate::handlers::admin::options;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/", routing::get(options::get_all_options))
        .route("/url", routing::get(options::get_url_options))
        .route(
            "/{key}",
            routing::get(options::get_option)
                .patch(options::upsert_option)
                .put(options::replace_option),
        )
}
