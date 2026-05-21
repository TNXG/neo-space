//! Categories / tags routes

use crate::app::SharedState;
use crate::handlers::admin::categories;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/", routing::post(categories::create_category))
        .route("/tags/list", routing::get(categories::list_tags))
        .route("/tags/{name}", routing::get(categories::get_posts_by_tag))
        .route(
            "/{id}",
            routing::put(categories::update_category).delete(categories::delete_category),
        )
}
