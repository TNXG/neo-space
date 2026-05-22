//! Admin posts write routes (owner-only)

use crate::app::SharedState;
use crate::handlers::admin::posts;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/", routing::post(posts::create_post))
        .route("/batch", routing::delete(posts::delete_posts_batch))
        .route(
            "/{id}",
            routing::put(posts::update_post)
                .patch(posts::update_post)
                .delete(posts::delete_post),
        )
}
