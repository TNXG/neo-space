//! Link/friend routes

use crate::app::SharedState;
use crate::handlers::link;

/// Create link routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        .route("/", axum::routing::get(link::list_links))
        .route("/{id}", axum::routing::get(link::get_link))
        .route("/send-code", axum::routing::post(link::send_verification_code))
        .route("/apply", axum::routing::post(link::apply_link))
}
