//! Note routes

use crate::app::SharedState;
use crate::handlers::note;

/// Create note routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        .route("/", axum::routing::get(note::list_notes))
        .route("/{id}", axum::routing::get(note::get_note))
        .route("/nid/{nid}", axum::routing::get(note::get_note_by_nid))
        .route(
            "/nid/{nid}/adjacent",
            axum::routing::get(note::get_adjacent_notes),
        )
}
