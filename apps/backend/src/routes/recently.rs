//! Recently (速记) admin routes

use crate::app::SharedState;
use crate::handlers::admin::says_recently as sr;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route(
            "/",
            routing::get(sr::list_recently_all)
                .post(sr::create_recently)
                .delete(sr::clear_recently),
        )
        .route(
            "/{id}",
            routing::put(sr::update_recently).delete(sr::delete_recently),
        )
}
