//! AI admin routes（summary / translation / writer helper / agent conversations）
//!
//! 与公共 /ai 路由（time-capsule 等）合并到 misc.rs 中暴露。

use crate::app::SharedState;
use crate::handlers::admin::{
    ai, ai_content_admin, ai_time_capsule_admin, ai_translation, ai_translation_admin,
    ai_translation_entries,
};
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route(
            "/writer/generate",
            routing::post(ai_content_admin::writer_generate),
        )
        .route("/summaries", routing::get(ai_content_admin::list_summaries))
        .route(
            "/summaries/{id}",
            routing::delete(ai_content_admin::delete_summary),
        )
        .route(
            "/translations/grouped",
            routing::get(ai_translation_admin::list_translations_grouped),
        )
        .route(
            "/translations/generate",
            routing::post(ai_translation::generate_translations),
        )
        .route(
            "/translations/entries",
            routing::get(ai_translation_entries::list_entries),
        )
        .route(
            "/translations/entries/{id}",
            routing::patch(ai_translation_entries::update_entry)
                .delete(ai_translation_entries::delete_entry),
        )
        .route(
            "/translations/ref/{ref_id}",
            routing::get(ai_translation_admin::get_translations_by_ref),
        )
        .route(
            "/translations/{id}",
            routing::patch(ai_translation_admin::update_translation)
                .delete(ai_translation_admin::delete_translation),
        )
        .route(
            "/time-capsule/contents",
            routing::get(ai_time_capsule_admin::list_contents),
        )
        .route(
            "/agent/conversations",
            routing::get(ai::list_conversations).post(ai::create_conversation),
        )
        .route(
            "/agent/conversations/{id}",
            routing::get(ai::get_conversation)
                .patch(ai::update_conversation)
                .delete(ai::delete_conversation),
        )
        .route(
            "/agent/conversations/{id}/messages",
            routing::patch(ai::append_messages).put(ai::replace_messages),
        )
}
