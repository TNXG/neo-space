//! 分类变更处理器

use crate::infrastructure::cache::CacheKey;

use super::super::service::ChangeStreamService;

/// 处理分类变更
pub async fn handle_category_change(service: &ChangeStreamService) {
    // 1. 清除本地缓存
    service
        .cache_service
        .invalidate(&CacheKey::Categories)
        .await;

    // 分类变更会影响博文列表，也需要清除
    service.cache_service.invalidate_by_prefix("posts").await;

    log::info!("已清除分类缓存");

    // 2. 通知 Next.js 重新验证
    if let Err(e) = service
        .revalidation_service
        .revalidate_tag("categories")
        .await
    {
        log::error!("通知 Next.js 重新验证失败: {e:?}");
    } else {
        log::info!("✓ 已通知 Next.js 重新验证分类页面");
    }
}
