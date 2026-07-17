//! 后台内容写入后的缓存、搜索索引与 ISR 同步。

use crate::app::SharedState;
use crate::models::{AiTranslation, Link, Note, Page, Post};
use crate::tasks::isr::trigger_isr_revalidation;
use crate::tasks::meilisearch_sync::{
    remove_note_from_meilisearch, remove_post_from_meilisearch, sync_note_to_meilisearch,
    sync_post_to_meilisearch, sync_translation_to_meilisearch,
};

/// 同步文章写入产生的派生状态；同步失败只记录日志，不影响已经提交的数据库写入。
pub async fn notify_post_changed(state: &SharedState, post: &Post, previous_slug: Option<&str>) {
    if post.is_published {
        if let Err(error) = sync_post_to_meilisearch(state, post.clone()).await {
            tracing::warn!(post_id = %post.id, %error, "文章已保存，但搜索索引同步失败");
        }
    } else if let Err(error) = remove_post_from_meilisearch(state, &post.id.to_hex()).await {
        tracing::warn!(post_id = %post.id, %error, "文章已保存，但搜索索引清理失败");
    }

    invalidate_post_cache(state, &post.id.to_hex(), previous_slug).await;
    invalidate_post_cache(state, &post.id.to_hex(), Some(&post.slug)).await;
    trigger_isr_revalidation(state, "posts", None).await;
}

/// 同步一批已删除文章的派生状态，并合并为一次 ISR 刷新。
pub async fn notify_posts_deleted(state: &SharedState, posts: &[Post]) {
    for post in posts {
        if let Err(error) = remove_post_from_meilisearch(state, &post.id.to_hex()).await {
            tracing::warn!(post_id = %post.id, %error, "文章已删除，但搜索索引清理失败");
        }
        invalidate_post_cache(state, &post.id.to_hex(), Some(&post.slug)).await;
    }

    if !posts.is_empty() {
        trigger_isr_revalidation(state, "posts", None).await;
    }
}

/// 同步手记写入产生的派生状态；同步失败只记录日志，不影响已经提交的数据库写入。
pub async fn notify_note_changed(state: &SharedState, note: &Note) {
    if note.is_published {
        if let Err(error) = sync_note_to_meilisearch(state, note.clone()).await {
            tracing::warn!(note_id = %note.id, %error, "手记已保存，但搜索索引同步失败");
        }
    } else if let Err(error) = remove_note_from_meilisearch(state, &note.id.to_hex()).await {
        tracing::warn!(note_id = %note.id, %error, "手记已保存，但搜索索引清理失败");
    }

    invalidate_note_cache(state, &note.id.to_hex(), note.nid).await;
    trigger_isr_revalidation(state, "notes", None).await;
}

/// 同步一批已删除手记的派生状态，并合并为一次 ISR 刷新。
pub async fn notify_notes_deleted(state: &SharedState, notes: &[Note]) {
    for note in notes {
        if let Err(error) = remove_note_from_meilisearch(state, &note.id.to_hex()).await {
            tracing::warn!(note_id = %note.id, %error, "手记已删除，但搜索索引清理失败");
        }
        invalidate_note_cache(state, &note.id.to_hex(), note.nid).await;
    }

    if !notes.is_empty() {
        trigger_isr_revalidation(state, "notes", None).await;
    }
}

/// 同步独立页面写入产生的缓存与 ISR 状态。
pub async fn notify_page_changed(state: &SharedState, page: &Page, previous_slug: Option<&str>) {
    state.cache.invalidate(&format!("page:{}", page.id)).await;
    if let Some(slug) = previous_slug {
        state.cache.invalidate(&format!("page:{slug}")).await;
    }
    state.cache.invalidate(&format!("page:{}", page.slug)).await;
    state.cache.invalidate("pages").await;
    trigger_isr_revalidation(state, "pages", None).await;
}

/// 同步已删除独立页面的缓存与 ISR 状态。
pub async fn notify_page_deleted(state: &SharedState, page: &Page) {
    state.cache.invalidate(&format!("page:{}", page.id)).await;
    state.cache.invalidate(&format!("page:{}", page.slug)).await;
    state.cache.invalidate("pages").await;
    trigger_isr_revalidation(state, "pages", None).await;
}

/// 同步友链写入产生的缓存，并仅在公开列表可能变化时刷新 ISR。
pub async fn notify_link_changed(state: &SharedState, link: &Link, previous_state: Option<i32>) {
    invalidate_link_cache(state, &link.id).await;
    if link.state == 0 || previous_state == Some(0) {
        trigger_isr_revalidation(state, "links", None).await;
    }
}

/// 同步已删除友链的缓存，并在其曾公开时刷新 ISR。
pub async fn notify_link_deleted(state: &SharedState, link: &Link) {
    invalidate_link_cache(state, &link.id).await;
    if link.state == 0 {
        trigger_isr_revalidation(state, "links", None).await;
    }
}

/// 根据翻译记录重建所属内容的多语言搜索文档。
pub async fn notify_translation_changed(state: &SharedState, translation: &AiTranslation) {
    if let Err(error) = sync_translation_to_meilisearch(state, translation.clone()).await {
        tracing::warn!(translation_id = %translation.id, %error, "翻译已保存，但搜索索引同步失败");
    }

    match translation.ref_type.as_str() {
        "posts" => trigger_isr_revalidation(state, "posts", None).await,
        "notes" => trigger_isr_revalidation(state, "notes", None).await,
        "pages" => trigger_isr_revalidation(state, "pages", None).await,
        _ => {}
    }
}

/// 失效文章的 ID 与 slug 缓存。
async fn invalidate_post_cache(state: &SharedState, post_id: &str, slug: Option<&str>) {
    state.cache.invalidate(&format!("post:{post_id}")).await;
    if let Some(slug) = slug {
        state.cache.invalidate(&format!("post:slug:{slug}")).await;
    }
}

/// 失效手记的 ID 与数字编号缓存。
async fn invalidate_note_cache(state: &SharedState, note_id: &str, nid: i32) {
    state.cache.invalidate(&format!("note:{note_id}")).await;
    state.cache.invalidate(&format!("note:nid:{nid}")).await;
}

/// 失效友链详情、列表与健康检查缓存。
async fn invalidate_link_cache(state: &SharedState, link_id: &str) {
    state.cache.invalidate(&format!("link:{link_id}")).await;
    state.cache.invalidate("links").await;
    state
        .link_health_cache
        .invalidate(&format!("link_health_{link_id}"))
        .await;
}
