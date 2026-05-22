//! Says (说说) routes

use crate::app::SharedState;
use crate::handlers::admin::says_recently as sr;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/", routing::get(sr::list_says).post(sr::create_say))
        .route("/{id}", routing::put(sr::update_say).delete(sr::delete_say))
}
