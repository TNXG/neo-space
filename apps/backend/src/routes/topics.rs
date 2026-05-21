//! Topics routes

use crate::app::SharedState;
use crate::handlers::admin::topics_snippets_projects as tsp;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route(
            "/",
            routing::get(tsp::list_topics).post(tsp::create_topic),
        )
        .route(
            "/{id}",
            routing::get(tsp::get_topic)
                .put(tsp::update_topic)
                .delete(tsp::delete_topic),
        )
}
