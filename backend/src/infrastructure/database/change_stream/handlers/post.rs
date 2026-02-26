//! 博文变更处理器

use mongodb::{bson::Document, bson::doc, change_stream::event::ChangeStreamEvent};

use crate::infrastructure::cache::CacheKey;
use crate::infrastructure::search::service::PostDocument;
use crate::models::Category;

use super::super::service::ChangeStreamService;

/// 处理博文变更
pub async fn handle_post_change(
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
    let mut post_id: Option<String> = None;
    let mut post_slug: Option<String> = None;

    // 从 document_key 获取 ID
    if let Some(doc_key) = &event.document_key
        && let Ok(id) = doc_key.get_object_id("_id")
    {
        post_id = Some(id.to_hex());
    }

    // 从 full_document 获取 slug
    if let Some(full_doc) = &event.full_document
        && let Ok(slug) = full_doc.get_str("slug")
    {
        post_slug = Some(slug.to_string());
    }

    // 1. 清除本地缓存（仅清除具体文章）
    if let Some(ref id) = post_id {
        service
            .cache_service
            .invalidate(&CacheKey::Post(id.clone()))
            .await;
        log::info!("已清除博文本地缓存: {id}");
    }

    // 2. 通知 Next.js 重新验证（细粒度刷新）
    let mut revalidated_tags = Vec::new();

    // 刷新具体文章（按 ID）
    if let Some(ref id) = post_id {
        let tag = format!("post-{id}");
        if service
            .revalidation_service
            .revalidate_tag(&tag)
            .await
            .is_ok()
        {
            revalidated_tags.push(tag);
        }
    }

    // 刷新具体文章（按 slug）
    if let Some(ref slug) = post_slug {
        let tag = format!("post-slug-{slug}");
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
        // 刷新博文列表（同时刷新 tag 和 ISR 页面）
        if service
            .revalidation_service
            .revalidate_both("posts", "/posts")
            .await
            .is_ok()
        {
            revalidated_tags.push("posts".to_string());
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
        service.cache_service.invalidate_by_prefix("posts").await;

        log::info!("✓ 博文数量变化 ({operation_type}) - 已刷新列表页和首页");
    }

    log::info!(
        "✓ 博文缓存已刷新 - id: {post_id:?}, slug: {post_slug:?}, tags: {revalidated_tags:?}"
    );

    // 3. 同步到 Meilisearch 搜索索引
    if let Some(ref search) = service.search_service {
        match event.operation_type {
            mongodb::change_stream::event::OperationType::Delete => {
                // 删除：从搜索索引移除
                if let Some(ref id) = post_id {
                    if let Err(e) = search.delete_post(id).await {
                        log::error!("从 Meilisearch 删除博文失败: {e}");
                    } else {
                        log::info!("✓ 已从 Meilisearch 删除博文: {id}");
                    }
                }
            }
            _ => {
                // 新增/更新：从 full_document 构建搜索文档并索引
                if let Some(full_doc) = &event.full_document {
                    // 仅索引已发布的文章
                    let is_published = full_doc.get_bool("isPublished").unwrap_or(false);
                    if !is_published {
                        // 未发布则从索引中删除（可能是取消发布）
                        if let Some(ref id) = post_id
                            && let Err(e) = search.delete_post(id).await
                        {
                            log::error!("从 Meilisearch 删除未发布博文失败: {e}");
                        }
                    } else if let Some(ref id) = post_id {
                        let title = full_doc.get_str("title").unwrap_or_default().to_string();
                        let text = full_doc.get_str("text").unwrap_or_default().to_string();
                        let slug = full_doc.get_str("slug").unwrap_or_default().to_string();
                        let tags: Vec<String> = full_doc
                            .get_array("tags")
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|v| v.as_str().map(String::from))
                                    .collect()
                            })
                            .unwrap_or_default();
                        let created = full_doc
                            .get_datetime("created")
                            .map(|dt| dt.timestamp_millis() / 1000)
                            .unwrap_or(0);

                        // 查找分类信息
                        let (category, category_name) = if let Ok(cat_id) =
                            full_doc.get_object_id("categoryId")
                        {
                            let categories_col = service.db.collection::<Category>("categories");
                            match categories_col.find_one(doc! { "_id": cat_id }).await {
                                Ok(Some(cat)) => (Some(cat.slug), Some(cat.name)),
                                _ => (None, None),
                            }
                        } else {
                            (None, None)
                        };

                        let doc = PostDocument {
                            id: id.clone(),
                            title,
                            text,
                            slug,
                            category,
                            category_name,
                            tags,
                            created,
                        };

                        if let Err(e) = search.index_post(doc).await {
                            log::error!("同步博文到 Meilisearch 失败: {e}");
                        } else {
                            log::info!("✓ 已同步博文到 Meilisearch: {id}");
                        }
                    }
                }
            }
        }
    }
}
