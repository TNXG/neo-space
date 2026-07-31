//! Bangumi integration routes.

use crate::{app::SharedState, handlers::bangumi};
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/library", routing::get(bangumi::get_library))
        .route("/crops", routing::get(bangumi::list_image_crops))
        .route("/crops/detect", routing::post(bangumi::detect_image_crop))
        .route(
            "/crops/{source_type}/{source_id}",
            routing::put(bangumi::upsert_image_crop),
        )
}
