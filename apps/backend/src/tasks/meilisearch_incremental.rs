//! 基于持久化变更事件的 Meilisearch 增量同步与失败重试。

use std::time::Duration;

use bson::{DateTime, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::Collection;

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::{Note, Post, SearchSyncEvent},
    tasks::meilisearch_sync::{
        remove_note_from_meilisearch, remove_post_from_meilisearch, sync_note_to_meilisearch,
        sync_post_to_meilisearch,
    },
};

const EVENT_COLLECTION: &str = "search_sync_events";

/// 将一次内容变化持久化，保证 Meilisearch 暂时不可用时可以自动重试。
pub async fn enqueue_incremental_sync(
    state: &SharedState,
    entity_type: &str,
    ref_id: &str,
) -> AppResult<()> {
    if !matches!(entity_type, "posts" | "notes") {
        return Err(AppError::BadRequest("不支持的搜索同步实体类型".to_string()));
    }
    event_collection(state)
        .insert_one(SearchSyncEvent::pending(entity_type, ref_id))
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(())
}

/// 分类名称或其翻译变化时，将所有关联文章加入 reconcile 队列。
pub async fn enqueue_category_posts(state: &SharedState, category_id: ObjectId) -> AppResult<()> {
    let post_ids = state
        .db
        .collection::<bson::Document>("posts")
        .find(doc! { "categoryId": category_id })
        .projection(doc! { "_id": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect::<Vec<bson::Document>>()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .into_iter()
        .filter_map(|document| document.get_object_id("_id").ok())
        .collect::<Vec<_>>();
    if post_ids.is_empty() {
        return Ok(());
    }
    let events = post_ids
        .iter()
        .map(|post_id| SearchSyncEvent::pending("posts", &post_id.to_hex()))
        .collect::<Vec<_>>();
    event_collection(state)
        .insert_many(events)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(())
}

/// 启动单工作器顺序消费变更，避免同一文档的更新乱序覆盖。
pub fn start_incremental_sync_worker(state: SharedState) {
    let startup_cutoff = DateTime::now();
    tokio::spawn(async move {
        recover_interrupted_events(&state, startup_cutoff).await;
        loop {
            match claim_next_event(&state).await {
                Ok(Some(event)) => process_event(&state, event).await,
                Ok(None) => tokio::time::sleep(Duration::from_secs(1)).await,
                Err(error) => {
                    tracing::warn!(?error, "读取 Meilisearch 增量同步队列失败");
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            }
        }
    });
}

/// 返回增量同步事件集合，供后续健康监控扩展复用。
pub fn event_collection(state: &SharedState) -> Collection<SearchSyncEvent> {
    state.db.collection(EVENT_COLLECTION)
}

/// 原子领取一个已到重试时间的事件。
async fn claim_next_event(state: &SharedState) -> AppResult<Option<SearchSyncEvent>> {
    event_collection(state)
        .find_one_and_update(
            doc! {
                "status": { "$in": ["pending", "failed"] },
                "nextAttemptAt": { "$lte": DateTime::now() },
            },
            doc! { "$set": { "status": "processing", "updatedAt": DateTime::now() } },
        )
        .sort(doc! { "createdAt": 1 })
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|error| AppError::Database(error.to_string()))
}

/// 依据数据库当前状态对索引执行幂等 reconcile，而不是重放过期的旧数据快照。
async fn process_event(state: &SharedState, event: SearchSyncEvent) {
    match reconcile_event(state, &event).await {
        Ok(()) => {
            let _ = event_collection(state)
                .update_one(
                    doc! { "_id": event.id },
                    doc! { "$set": {
                        "status": "succeeded",
                        "lastError": null,
                        "updatedAt": DateTime::now(),
                    } },
                )
                .await;
        }
        Err(error) => {
            let attempts = event.attempts + 1;
            let retry_seconds = 2_i64.pow(attempts.clamp(1, 10) as u32);
            let next_attempt =
                DateTime::from_millis(DateTime::now().timestamp_millis() + retry_seconds * 1000);
            let message = format!("{error:?}");
            let _ = event_collection(state)
                .update_one(
                    doc! { "_id": event.id },
                    doc! { "$set": {
                        "status": "failed",
                        "attempts": attempts,
                        "lastError": &message,
                        "nextAttemptAt": next_attempt,
                        "updatedAt": DateTime::now(),
                    } },
                )
                .await;
            tracing::warn!(entity_type = event.entity_type, ref_id = event.ref_id, attempts, %message, "Meilisearch 增量同步失败，将自动重试");
        }
    }
}

/// 根据实体类型读取最新数据库状态并写入或删除索引文档。
async fn reconcile_event(state: &SharedState, event: &SearchSyncEvent) -> AppResult<()> {
    let object_id = ObjectId::parse_str(&event.ref_id)
        .map_err(|_| AppError::BadRequest("搜索同步事件 ref_id 无效".to_string()))?;
    match event.entity_type.as_str() {
        "posts" => {
            let post = state
                .db
                .collection::<Post>("posts")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?;
            if let Some(post) = post.filter(|post| post.is_published) {
                sync_post_to_meilisearch(state, post)
                    .await
                    .map_err(|error| AppError::Internal(error.to_string()))?;
            } else {
                remove_post_from_meilisearch(state, &event.ref_id)
                    .await
                    .map_err(|error| AppError::Internal(error.to_string()))?;
            }
        }
        "notes" => {
            let note = state
                .db
                .collection::<Note>("notes")
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?;
            if let Some(note) = note.filter(|note| note.is_published) {
                sync_note_to_meilisearch(state, note)
                    .await
                    .map_err(|error| AppError::Internal(error.to_string()))?;
            } else {
                remove_note_from_meilisearch(state, &event.ref_id)
                    .await
                    .map_err(|error| AppError::Internal(error.to_string()))?;
            }
        }
        _ => return Err(AppError::BadRequest("不支持的搜索同步事件".to_string())),
    }
    Ok(())
}

/// 服务重启时把处理中事件放回等待队列，防止事件永久卡死。
async fn recover_interrupted_events(state: &SharedState, startup_cutoff: DateTime) {
    let _ = event_collection(state)
        .update_many(
            doc! {
                "status": "processing",
                "updatedAt": { "$lt": startup_cutoff },
            },
            doc! { "$set": {
                "status": "pending",
                "nextAttemptAt": DateTime::now(),
                "updatedAt": DateTime::now(),
            } },
        )
        .await;
}
