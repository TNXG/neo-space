//! Comment routes

use crate::app::SharedState;
use crate::handlers;

/// Create comment routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        // Public comment operations
        .route(
            "/",
            axum::routing::get(handlers::comment::list_comments)
                .post(handlers::comment::create_comment),
        )
        // Admin comment operations
        .route(
            "/{id}",
            axum::routing::put(handlers::admin::comment::update_comment)
                .delete(handlers::admin::comment::delete_comment),
        )
        .route(
            "/{id}/hide",
            axum::routing::patch(handlers::admin::comment::hide_comment)
                .delete(handlers::admin::comment::unhide_comment),
        )
        .route(
            "/{id}/pin",
            axum::routing::patch(handlers::admin::comment::pin_comment)
                .delete(handlers::admin::comment::unpin_comment),
        )
}
