//! Post/article routes

use crate::app::SharedState;
use crate::handlers::post;

/// Create post routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        .route("/", axum::routing::get(post::list_posts))
        .route("/{id}", axum::routing::get(post::get_post))
        .route("/slug/{slug}", axum::routing::get(post::get_post_by_slug))
        .route(
            "/slug/{slug}/adjacent",
            axum::routing::get(post::get_adjacent_posts),
        )
}
