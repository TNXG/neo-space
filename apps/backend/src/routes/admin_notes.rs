//! Admin notes write routes (owner-only)

use crate::app::SharedState;
use crate::handlers::admin::notes;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/", routing::post(notes::create_note))
        .route("/batch", routing::delete(notes::delete_notes_batch))
        .route("/admin/all", routing::get(notes::list_notes_admin))
        .route(
            "/{id}",
            routing::put(notes::update_note).delete(notes::delete_note),
        )
}
