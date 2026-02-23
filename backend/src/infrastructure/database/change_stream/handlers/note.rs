//! 手记变更处理器

use mongodb::{bson::Document, change_stream::event::ChangeStreamEvent};

use crate::infrastructure::cache::CacheKey;
use crate::infrastructure::search::service::NoteDocument;

use super::super::service::ChangeStreamService;

/// 处理手记变更
pub async fn handle_note_change(
    service: &ChangeStreamService,
    event: &ChangeStreamEvent<Document>,
) {
    let operation_type = format!("{:?}", event.operation_type);
    let is_count_change = matches!(
        event.operation_type,
        mongodb::change_stream::event::OperationType::Insert
            | mongodb::change_stream::event::OperationType::Delete
    );

    // 提取文档信息
    let mut note_id: Option<String> = None;
    let mut nid: Option<i32> = None;

    // 从 document_key 获取 ID
    if let Some(doc_key) = &event.document_key {
        if let Ok(id) = doc_key.get_object_id("_id") {
            note_id = Some(id.to_hex());
        }
    }

    // 从 full_document 获取 nid
    if let Some(full_doc) = &event.full_document {
        if let Ok(nid_value) = full_doc.get_i32("nid") {
            nid = Some(nid_value);
        }
    }

    // 1. 清除本地缓存（仅清除具体手记）
    if let Some(ref id) = note_id {
        service
            .cache_service
            .invalidate(&CacheKey::Note(id.clone()))
            .await;
        log::info!("已清除手记本地缓存: {id}");
    }

    // 2. 通知 Next.js 重新验证（细粒度刷新）
    let mut revalidated_tags = Vec::new();

    // 刷新具体手记（按 ID）
    if let Some(ref id) = note_id {
        let tag = format!("note-{id}");
        if service
            .revalidation_service
            .revalidate_tag(&tag)
            .await
            .is_ok()
        {
            revalidated_tags.push(tag);
        }
    }

    // 刷新具体手记（按 nid）
    if let Some(nid_value) = nid {
        let tag = format!("note-nid-{nid_value}");
        if service
            .revalidation_service
            .revalidate_tag(&tag)
            .await
            .is_ok()
        {
            revalidated_tags.push(tag);
        }
    }

    // 仅在数量变化（insert/delete）时刷新列表页、首页和 Moka 缓存
    if is_count_change {
        // 刷新手记列表（同时刷新 tag 和 ISR 页面）
        if service
            .revalidation_service
            .revalidate_both("notes", "/notes")
            .await
            .is_ok()
        {
            revalidated_tags.push("notes".to_string());
        }

        // 刷新首页（同时刷新 tag 和 ISR 页面）
        if service
            .revalidation_service
            .revalidate_both("home", "/")
            .await
            .is_ok()
        {
            revalidated_tags.push("home".to_string());
        }

        // 清除 Moka 列表缓存
        service.cache_service.invalidate_by_prefix("notes").await;

        log::info!("✓ 手记数量变化 ({operation_type}) - 已刷新列表页和首页");
    }

    log::info!("✓ 手记缓存已刷新 - id: {note_id:?}, nid: {nid:?}, tags: {revalidated_tags:?}");

    // 3. 同步到 Meilisearch 搜索索引
    if let Some(ref search) = service.search_service {
        match event.operation_type {
            mongodb::change_stream::event::OperationType::Delete => {
                // 删除：从搜索索引移除
                if let Some(ref id) = note_id {
                    if let Err(e) = search.delete_note(id).await {
                        log::error!("从 Meilisearch 删除手记失败: {e}");
                    } else {
                        log::info!("✓ 已从 Meilisearch 删除手记: {id}");
                    }
                }
            }
            _ => {
                // 新增/更新：从 full_document 构建搜索文档并索引
                if let Some(full_doc) = &event.full_document {
                    if let (Some(id), Some(nid_value)) = (&note_id, nid) {
                        let title = full_doc.get_str("title").unwrap_or_default().to_string();
                        let text = full_doc.get_str("text").unwrap_or_default().to_string();
                        let created = full_doc
                            .get_datetime("created")
                            .map(|dt| dt.timestamp_millis() / 1000)
                            .unwrap_or(0);

                        let doc = NoteDocument {
                            id: id.clone(),
                            title,
                            text,
                            nid: nid_value,
                            created,
                        };

                        if let Err(e) = search.index_note(doc).await {
                            log::error!("同步手记到 Meilisearch 失败: {e}");
                        } else {
                            log::info!("✓ 已同步手记到 Meilisearch: {id}");
                        }
                    }
                }
            }
        }
    }
}
