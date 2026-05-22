//! Drafts routes (owner-only)

use crate::app::SharedState;
use crate::handlers::admin::{draft_history, drafts};
use axum::{Router, routing};

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
        .route(
            "/{id}/history",
            routing::get(draft_history::list_draft_history),
        )
        .route(
            "/{id}/history/{version}",
            routing::get(draft_history::get_draft_history_version),
        )
        .route(
            "/{id}/restore/{version}",
            routing::post(draft_history::restore_draft_version),
        )
        .route("/{id}/publish", routing::post(drafts::publish_draft))
        .route(
            "/by-ref/{ref_type}/new",
            routing::get(drafts::get_new_drafts),
        )
        .route(
            "/by-ref/{ref_type}/{ref_id}",
            routing::get(drafts::get_draft_by_ref),
        )
}
