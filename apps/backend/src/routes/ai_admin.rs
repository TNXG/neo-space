//! AI admin routes（writer / summary / agent conversations）
//!
//! 与公共 /ai 路由（time-capsule 等）合并到 misc.rs 中暴露。

use crate::app::SharedState;
use crate::handlers::admin::ai;
use axum::{Router, routing};

pub fn routes() -> Router<SharedState> {
    Router::new()
        .route("/writer/generate", routing::post(ai::writer_generate))
        .route("/summaries", routing::get(ai::list_summaries))
        .route("/summaries/{id}", routing::delete(ai::delete_summary))
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
