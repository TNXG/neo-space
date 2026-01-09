//! Change Stream service - `MongoDB` Change Stream listener with auto-reconnect

use futures::stream::TryStreamExt;
use mongodb::{
    bson::{doc, Document},
    change_stream::event::ChangeStreamEvent,
    options::{ChangeStreamOptions, ReadConcern},
    Database,
};
use std::time::Duration;
use tokio::time::sleep;

use crate::infrastructure::cache::CacheKey;
use crate::infrastructure::{CacheService, RevalidationService};

/// Change Stream 监听服务
pub struct ChangeStreamService {
    db: Database,
    cache_service: CacheService,
    revalidation_service: RevalidationService,
}

impl ChangeStreamService {
    /// 创建新的 Change Stream 服务实例
    pub fn new(
        db: Database,
        cache_service: CacheService,
        revalidation_service: RevalidationService,
    ) -> Self {
        Self {
            db,
            cache_service,
            revalidation_service,
        }
    }

    /// 启动 Change Stream 监听（带自动重连）
    pub async fn start_watching(&self) {
        log::info!("启动 MongoDB Change Stream 监听服务...");

        loop {
            match self.watch_collections().await {
                Ok(()) => {
                    log::warn!("Change Stream 正常结束，准备重新连接...");
                }
                Err(e) => {
                    log::error!("Change Stream 错误: {e:?}");
                    log::info!("5秒后尝试重新连接...");
                }
            }

            // 等待后重连
            sleep(Duration::from_secs(5)).await;
        }
    }

    /// 监听集合变更
    async fn watch_collections(&self) -> Result<(), mongodb::error::Error> {
        // 配置 Change Stream 选项
        let pipeline = vec![doc! {
            "$match": {
                "operationType": { "$in": ["insert", "update", "replace", "delete"] },
                "ns.coll": { "$in": ["posts", "notes", "pages", "categories", "links"] }
            }
        }];

        let options = ChangeStreamOptions::builder()
            .full_document(Some(mongodb::options::FullDocumentType::UpdateLookup))
            .build();

        log::info!("正在建立 Change Stream 连接...");
        let mut change_stream = self
            .db
            .watch()
            .pipeline(pipeline)
            .with_options(options)
            .read_concern(ReadConcern::majority())
            .await?;

        log::info!("✓ Change Stream 连接成功，开始监听数据变更");

        // 持续监听变更事件
        while let Some(event) = change_stream.try_next().await? {
            self.handle_change_event(event).await;
        }

        Ok(())
    }

    /// 处理变更事件
    async fn handle_change_event(&self, event: ChangeStreamEvent<Document>) {
        let operation_type = format!("{:?}", event.operation_type);
        let collection_name = event
            .ns
            .as_ref()
            .and_then(|ns| ns.coll.as_deref())
            .unwrap_or("unknown");

        log::info!("检测到数据变更 - 集合: {collection_name}, 操作: {operation_type}");

        // 根据集合类型处理缓存失效
        match collection_name {
            "posts" => {
                self.handle_post_change(&event).await;
            }
            "notes" => {
                self.handle_note_change(&event).await;
            }
            "pages" => {
                self.handle_page_change(&event).await;
            }
            "categories" => {
                self.handle_category_change().await;
            }
            "links" => {
                self.handle_link_change(&event).await;
            }
            _ => {
                log::debug!("忽略集合: {collection_name}");
            }
        }
    }

    /// 处理博文变更
    async fn handle_post_change(&self, event: &ChangeStreamEvent<Document>) {
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
        if let Some(doc_key) = &event.document_key {
            if let Ok(id) = doc_key.get_object_id("_id") {
                post_id = Some(id.to_hex());
            }
        }

        // 从 full_document 获取 slug
        if let Some(full_doc) = &event.full_document {
            if let Ok(slug) = full_doc.get_str("slug") {
                post_slug = Some(slug.to_string());
            }
        }

        // 1. 清除本地缓存（仅清除具体文章）
        if let Some(ref id) = post_id {
            self.cache_service
                .invalidate(&CacheKey::Post(id.clone()))
                .await;
            log::info!("已清除博文本地缓存: {id}");
        }

        // 2. 通知 Next.js 重新验证（细粒度刷新）
        let mut revalidated_tags = Vec::new();

        // 刷新具体文章（按 ID）
        if let Some(ref id) = post_id {
            let tag = format!("post-{id}");
            if self.revalidation_service.revalidate_tag(&tag).await.is_ok() {
                revalidated_tags.push(tag);
            }
        }

        // 刷新具体文章（按 slug）
        if let Some(ref slug) = post_slug {
            let tag = format!("post-slug-{slug}");
            if self.revalidation_service.revalidate_tag(&tag).await.is_ok() {
                revalidated_tags.push(tag);
            }
        }

        // 仅在数量变化（insert/delete）时刷新列表页、首页和 Moka 缓存
        if is_count_change {
            // 刷新博文列表（同时刷新 tag 和 ISR 页面）
            if self
                .revalidation_service
                .revalidate_both("posts", "/posts")
                .await
                .is_ok()
            {
                revalidated_tags.push("posts".to_string());
            }

            // 刷新首页（同时刷新 tag 和 ISR 页面）
            if self
                .revalidation_service
                .revalidate_both("home", "/")
                .await
                .is_ok()
            {
                revalidated_tags.push("home".to_string());
            }

            // 清除 Moka 列表缓存
            self.cache_service.invalidate_by_prefix("posts").await;

            log::info!("✓ 博文数量变化 ({operation_type}) - 已刷新列表页和首页");
        }

        log::info!(
            "✓ 博文缓存已刷新 - id: {post_id:?}, slug: {post_slug:?}, tags: {revalidated_tags:?}"
        );
    }

    /// 处理手记变更
    async fn handle_note_change(&self, event: &ChangeStreamEvent<Document>) {
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
            self.cache_service
                .invalidate(&CacheKey::Note(id.clone()))
                .await;
            log::info!("已清除手记本地缓存: {id}");
        }

        // 2. 通知 Next.js 重新验证（细粒度刷新）
        let mut revalidated_tags = Vec::new();

        // 刷新具体手记（按 ID）
        if let Some(ref id) = note_id {
            let tag = format!("note-{id}");
            if self.revalidation_service.revalidate_tag(&tag).await.is_ok() {
                revalidated_tags.push(tag);
            }
        }

        // 刷新具体手记（按 nid）
        if let Some(nid_value) = nid {
            let tag = format!("note-nid-{nid_value}");
            if self.revalidation_service.revalidate_tag(&tag).await.is_ok() {
                revalidated_tags.push(tag);
            }
        }

        // 仅在数量变化（insert/delete）时刷新列表页、首页和 Moka 缓存
        if is_count_change {
            // 刷新手记列表（同时刷新 tag 和 ISR 页面）
            if self
                .revalidation_service
                .revalidate_both("notes", "/notes")
                .await
                .is_ok()
            {
                revalidated_tags.push("notes".to_string());
            }

            // 刷新首页（同时刷新 tag 和 ISR 页面）
            if self
                .revalidation_service
                .revalidate_both("home", "/")
                .await
                .is_ok()
            {
                revalidated_tags.push("home".to_string());
            }

            // 清除 Moka 列表缓存
            self.cache_service.invalidate_by_prefix("notes").await;

            log::info!("✓ 手记数量变化 ({operation_type}) - 已刷新列表页和首页");
        }

        log::info!(
            "✓ 手记缓存已刷新 - id: {note_id:?}, nid: {nid:?}, tags: {revalidated_tags:?}"
        );
    }

    /// 处理页面变更
    async fn handle_page_change(&self, event: &ChangeStreamEvent<Document>) {
        // 提取 slug
        let page_slug = event
            .full_document
            .as_ref()
            .and_then(|doc| doc.get_str("slug").ok())
            .map(std::string::ToString::to_string);

        // 1. 清除本地缓存（仅清除具体页面）
        if let Some(ref slug) = page_slug {
            self.cache_service
                .invalidate(&CacheKey::Page(slug.clone()))
                .await;
            log::info!("已清除页面本地缓存: {slug}");
        }

        // 2. 通知 Next.js 重新验证（仅刷新具体页面，不刷新整个 pages 标签）
        let mut revalidated_tags = Vec::new();

        if let Some(ref slug) = page_slug {
            let tag = format!("page-{slug}");
            if self.revalidation_service.revalidate_tag(&tag).await.is_ok() {
                revalidated_tags.push(tag);
            }
        }

        log::info!("✓ 页面缓存已刷新 - slug: {page_slug:?}, tags: {revalidated_tags:?}");
    }

    /// 处理分类变更
    async fn handle_category_change(&self) {
        // 1. 清除本地缓存
        self.cache_service.invalidate(&CacheKey::Categories).await;

        // 分类变更会影响博文列表，也需要清除
        self.cache_service.invalidate_by_prefix("posts").await;

        log::info!("已清除分类缓存");

        // 2. 通知 Next.js 重新验证
        if let Err(e) = self.revalidation_service.revalidate_tag("categories").await {
            log::error!("通知 Next.js 重新验证失败: {e:?}");
        } else {
            log::info!("✓ 已通知 Next.js 重新验证分类页面");
        }
    }

    /// 处理友链变更
    async fn handle_link_change(&self, event: &ChangeStreamEvent<Document>) {
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
                self.cache_service
                    .invalidate(&CacheKey::Link(id.clone()))
                    .await;
                log::info!("已清除友链本地缓存: {id}");
            }

            // 清除友链列表缓存
            self.cache_service.invalidate_by_prefix("links").await;

            // 2. 通知 Next.js 重新验证（同时刷新 tag 和 ISR 页面）
            if let Err(e) = self
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
}
