//! Files upload route (admin)

use crate::app::SharedState;
use crate::handlers::admin::files;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new().route("/upload", routing::post(files::upload_file))
}
