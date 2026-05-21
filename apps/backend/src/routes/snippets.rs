//! Snippets routes

use crate::app::SharedState;
use crate::handlers::admin::topics_snippets_projects as tsp;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route(
            "/",
            routing::get(tsp::list_snippets).post(tsp::create_snippet),
        )
        .route("/{id}", routing::delete(tsp::delete_snippet))
}
