//! Meilisearch 管理与维护路由（owner-only）。

use axum::{Router, routing};

use crate::{
    app::SharedState,
    handlers::admin::{meilisearch, meilisearch_maintenance, meilisearch_vector},
};

/// 构建 Meilisearch 管理路由。
pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/overview", routing::get(meilisearch::overview))
        .route(
            "/indexes",
            routing::get(meilisearch::list_indexes).post(meilisearch::create_index),
        )
        .route(
            "/indexes/{index_uid}",
            routing::delete(meilisearch::delete_index),
        )
        .route(
            "/indexes/{index_uid}/documents",
            routing::get(meilisearch::list_documents).post(meilisearch::upsert_documents),
        )
        .route(
            "/indexes/{index_uid}/documents/export",
            routing::get(meilisearch::export_documents),
        )
        .route(
            "/indexes/{index_uid}/documents/{document_id}",
            routing::get(meilisearch::get_document).delete(meilisearch::delete_document),
        )
        .route(
            "/indexes/{index_uid}/settings",
            routing::get(meilisearch::get_settings).patch(meilisearch::update_settings),
        )
        .route("/tasks", routing::get(meilisearch::list_tasks))
        .route("/tasks/cancel", routing::post(meilisearch::cancel_tasks))
        .route(
            "/vector-config",
            routing::get(meilisearch_vector::get_vector_config)
                .put(meilisearch_vector::update_vector_config),
        )
        .route(
            "/maintenance/tasks",
            routing::get(meilisearch_maintenance::list_maintenance_tasks),
        )
        .route(
            "/maintenance/sync-events",
            routing::get(meilisearch_maintenance::list_sync_events),
        )
        .route(
            "/maintenance/sync-events/{event_id}/retry",
            routing::post(meilisearch_maintenance::retry_sync_event),
        )
        .route(
            "/maintenance/rebuild",
            routing::post(meilisearch_maintenance::create_rebuild),
        )
        .route(
            "/maintenance/tasks/{task_id}/retry",
            routing::post(meilisearch_maintenance::retry_rebuild),
        )
        .route(
            "/maintenance/tasks/{task_id}/cancel",
            routing::post(meilisearch_maintenance::cancel_rebuild),
        )
        .route(
            "/maintenance/schedule",
            routing::get(meilisearch_maintenance::get_schedule)
                .put(meilisearch_maintenance::update_schedule),
        )
}
