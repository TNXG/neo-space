//! Admin misc routes：cron-task / backup / search-index / webhooks /
//! subscribe / token / dependencies / health-test / activity / analyze / pty

use crate::app::SharedState;
use crate::handlers::admin::misc;
use axum::{routing, Router};

pub fn routes() -> Router<SharedState> {
    Router::new()
        // cron-task
        .route(
            "/cron-task",
            routing::get(misc::list_cron_definitions).post(misc::trigger_cron_task),
        )
        .route("/cron-task/list", routing::get(misc::list_cron_tasks))
        // backup
        .route("/backup", routing::get(misc::list_backups))
        // search-index
        .route(
            "/search-index/rebuild",
            routing::post(misc::rebuild_search_index),
        )
        .route(
            "/search-index/status",
            routing::get(misc::search_index_status),
        )
        // webhooks
        .route(
            "/webhooks",
            routing::get(misc::list_webhooks).post(misc::upsert_webhook),
        )
        .route("/webhooks/{id}", routing::delete(misc::delete_webhook))
        // subscribe
        .route("/subscribe", routing::get(misc::list_subscribers))
        // token
        .route(
            "/token",
            routing::get(misc::list_tokens).post(misc::create_token),
        )
        .route("/token/{id}", routing::delete(misc::delete_token))
        // ack-only stubs（passkey / dependencies / health-test / activity / analyze / pty）
        .route("/passkey", routing::get(misc::empty_array))
        .route("/dependencies", routing::get(misc::empty_array))
        .route("/health-test", routing::post(misc::empty_ok))
        .route("/activity", routing::get(misc::empty_array))
        .route("/analyze", routing::get(misc::empty_ok))
        .route("/pty", routing::get(misc::empty_ok))
}
