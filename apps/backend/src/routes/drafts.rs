//! Drafts routes (owner-only)

use crate::app::SharedState;
use crate::handlers::admin::drafts;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route(
            "/",
            routing::get(drafts::list_drafts).post(drafts::create_draft),
        )
        .route(
            "/{id}",
            routing::get(drafts::get_draft)
                .put(drafts::update_draft)
                .delete(drafts::delete_draft),
        )
        .route("/{id}/publish", routing::post(drafts::publish_draft))
        .route(
            "/by-ref/{ref_type}/{ref_id}",
            routing::get(drafts::get_draft_by_ref),
        )
}
