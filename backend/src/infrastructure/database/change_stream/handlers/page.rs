//! 页面变更处理器

use mongodb::{bson::Document, change_stream::event::ChangeStreamEvent};

use crate::infrastructure::cache::CacheKey;

use super::super::service::ChangeStreamService;

/// 处理页面变更
pub async fn handle_page_change(
    service: &ChangeStreamService,
    event: &ChangeStreamEvent<Document>,
) {
    // 提取 slug
    let page_slug = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_str("slug").ok())
        .map(std::string::ToString::to_string);

    // 1. 清除本地缓存（仅清除具体页面）
    if let Some(ref slug) = page_slug {
        service
            .cache_service
            .invalidate(&CacheKey::Page(slug.clone()))
            .await;
        log::info!("已清除页面本地缓存: {slug}");
    }

    // 2. 通知 Next.js 重新验证（仅刷新具体页面，不刷新整个 pages 标签）
    let mut revalidated_tags = Vec::new();

    if let Some(ref slug) = page_slug {
        let tag = format!("page-{slug}");
        if service
            .revalidation_service
            .revalidate_tag(&tag)
            .await
            .is_ok()
        {
            revalidated_tags.push(tag);
        }
    }

    log::info!("✓ 页面缓存已刷新 - slug: {page_slug:?}, tags: {revalidated_tags:?}");
}
