//! Bangumi integration routes.

use crate::{app::SharedState, handlers::bangumi};
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/profile", routing::get(bangumi::get_profile))
        .route("/library", routing::get(bangumi::get_library))
}
