//! Change Stream 核心服务

use futures::stream::TryStreamExt;
use mongodb::{
    bson::{doc, Document},
    change_stream::event::ChangeStreamEvent,
    options::{ChangeStreamOptions, ReadConcern},
    Database,
};
use std::time::Duration;
use tokio::time::sleep;

use crate::infrastructure::search::service::SearchService;
use crate::infrastructure::{CacheService, RevalidationService};

use super::handlers;

/// Change Stream 监听服务
pub struct ChangeStreamService {
    pub(super) db: Database,
    pub(super) cache_service: CacheService,
    pub(super) revalidation_service: RevalidationService,
    pub(super) search_service: Option<SearchService>,
}

impl ChangeStreamService {
    /// 创建新的 Change Stream 服务实例
    pub fn new(
        db: Database,
        cache_service: CacheService,
        revalidation_service: RevalidationService,
        search_service: Option<SearchService>,
    ) -> Self {
        Self {
            db,
            cache_service,
            revalidation_service,
            search_service,
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
                handlers::handle_post_change(self, &event).await;
            }
            "notes" => {
                handlers::handle_note_change(self, &event).await;
            }
            "pages" => {
                handlers::handle_page_change(self, &event).await;
            }
            "categories" => {
                handlers::handle_category_change(self).await;
            }
            "links" => {
                handlers::handle_link_change(self, &event).await;
            }
            _ => {
                log::debug!("忽略集合: {collection_name}");
            }
        }
    }
}
