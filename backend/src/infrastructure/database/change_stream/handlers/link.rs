//! 友链变更处理器

use mongodb::{bson::Document, change_stream::event::ChangeStreamEvent};

use crate::infrastructure::cache::CacheKey;

use super::super::service::ChangeStreamService;

/// 处理友链变更
pub async fn handle_link_change(
    service: &ChangeStreamService,
    event: &ChangeStreamEvent<Document>,
) {
    let operation_type = format!("{:?}", event.operation_type);

    // 提取友链信息
    let mut link_id: Option<String> = None;
    let mut link_state: Option<i32> = None;
    let mut link_name: Option<String> = None;

    // 从 document_key 获取 ID
    if let Some(doc_key) = &event.document_key {
        if let Ok(id) = doc_key.get_object_id("_id") {
            link_id = Some(id.to_hex());
        }
    }

    // 从 full_document 获取状态和名称
    if let Some(full_doc) = &event.full_document {
        if let Ok(state) = full_doc.get_i32("state") {
            link_state = Some(state);
        }
        if let Ok(name) = full_doc.get_str("name") {
            link_name = Some(name.to_string());
        }
    }

    // 判断是否需要刷新友链页面
    let should_refresh = match event.operation_type {
        // 新增友链：如果是正常状态（审核通过），需要刷新
        mongodb::change_stream::event::OperationType::Insert => {
            link_state == Some(0) // LinkState::NORMAL
        }
        // 更新友链：如果状态变为正常（审核通过），需要刷新
        mongodb::change_stream::event::OperationType::Update
        | mongodb::change_stream::event::OperationType::Replace => {
            link_state == Some(0) // LinkState::NORMAL
        }
        // 删除友链：总是需要刷新
        mongodb::change_stream::event::OperationType::Delete => true,
        _ => false,
    };

    if should_refresh {
        // 1. 清除本地缓存
        if let Some(ref id) = link_id {
            service
                .cache_service
                .invalidate(&CacheKey::Link(id.clone()))
                .await;
            log::info!("已清除友链本地缓存: {id}");
        }

        // 清除友链列表缓存
        service.cache_service.invalidate_by_prefix("links").await;

        // 2. 通知 Next.js 重新验证（同时刷新 tag 和 ISR 页面）
        if let Err(e) = service
            .revalidation_service
            .revalidate_both("links", "/friends")
            .await
        {
            log::error!("通知 Next.js 重新验证友链失败: {e:?}");
        } else {
            log::info!(
                "✓ 友链缓存已刷新 - id: {link_id:?}, name: {link_name:?}, state: {link_state:?}, operation: {operation_type}"
            );
        }
    } else {
        log::debug!(
            "友链变更不需要刷新页面 - id: {link_id:?}, state: {link_state:?}, operation: {operation_type}"
        );
    }
}
