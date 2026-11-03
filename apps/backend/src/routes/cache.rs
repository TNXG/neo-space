//! Public API response cache maintenance routes, mounted at /admin/cache.

use crate::{app::SharedState, handlers::admin::cache};
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new().route("/", routing::delete(cache::clear_cache))
}
