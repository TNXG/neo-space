//! Categories / tags routes

use crate::app::SharedState;
use crate::handlers::admin::categories;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route(
            "/",
            routing::get(categories::list_categories).post(categories::create_category),
        )
        .route("/tags/list", routing::get(categories::list_tags))
        .route("/tags/{name}", routing::get(categories::get_posts_by_tag))
        .route(
            "/{id}",
            routing::put(categories::update_category).delete(categories::delete_category),
        )
}
