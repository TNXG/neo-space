//! Miscellaneous routes (config, search, AI, pages, artworks)

use crate::app::SharedState;
use crate::handlers;

/// Create miscellaneous routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        // Config and metadata
        .route("/config", axum::routing::get(handlers::misc::get_config))
        .route(
            "/recentlies",
            axum::routing::get(handlers::misc::list_recentlies),
        )
        .route(
            "/categories",
            axum::routing::get(handlers::misc::list_categories),
        )
        .route(
            "/nbnhhsh/guess",
            axum::routing::post(handlers::misc::nbnhhsh_guess),
        )
        // Nav hover aggregated feed
        .route(
            "/aggregate/nav",
            axum::routing::get(handlers::misc::aggregate_nav),
        )
        // Search
        .route("/search", axum::routing::get(handlers::search::search))
        // AI features
        .route(
            "/ai/time-capsule",
            axum::routing::post(handlers::ai::analyze_time_capsule),
        )
        .route(
            "/ai/time-capsule/{ref_id}",
            axum::routing::get(handlers::ai::get_time_capsule),
        )
        // Pages
        .route(
            "/pages/{slug}",
            axum::routing::get(handlers::page::get_page_by_slug),
        )
        // Artworks
        .route(
            "/artworks/{filename}",
            axum::routing::get(handlers::artwork::serve_artwork),
        )
}
