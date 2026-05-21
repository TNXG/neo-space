//! WebSocket routes

use crate::app::SharedState;
use crate::realtime;

/// Create WebSocket routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        .route(
            "/owner-desktop",
            axum::routing::get(realtime::owner_desktop_ws),
        )
        .route("/reader", axum::routing::get(realtime::reader_ws))
}
