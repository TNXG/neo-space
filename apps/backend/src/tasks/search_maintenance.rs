//! Meilisearch 索引重建任务与定时调度。

use bson::{DateTime, doc, oid::ObjectId};
use mongodb::Collection;
use reqwest::Method;
use serde_json::{Value, json};

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    external::meilisearch_admin::MeilisearchAdminClient,
    models::SearchMaintenanceTask,
};

use super::meilisearch_sync::rebuild_documents::{collect_note_documents, collect_post_documents};

const TASK_COLLECTION: &str = "search_maintenance_tasks";
mod scheduler;

pub use scheduler::{default_schedule, schedule_collection, start_search_maintenance_scheduler};

/// 创建并异步执行索引重建任务。
pub async fn enqueue_rebuild(
    state: SharedState,
    scheduled: bool,
    source_task_id: Option<ObjectId>,
) -> AppResult<SearchMaintenanceTask> {
    let task = SearchMaintenanceTask::queued(scheduled, source_task_id);
    task_collection(&state)
        .insert_one(&task)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let spawned_task = task.clone();
    tokio::spawn(async move {
        execute_rebuild(state, spawned_task.id).await;
    });
    Ok(task)
}

/// 确保受管索引首次部署时存在；不会清空数据或覆盖已有配置。
pub async fn ensure_managed_indexes(state: &SharedState) -> AppResult<()> {
    let client = MeilisearchAdminClient::from_state(state);
    for (uid, settings) in [
        (
            "posts",
            json!({
                "searchableAttributes": ["title", "text", "category_name", "tags"],
                "filterableAttributes": ["lang", "ref_id", "category", "tags", "created"],
                "sortableAttributes": ["created"]
            }),
        ),
        (
            "notes",
            json!({
                "searchableAttributes": ["title", "text"],
                "filterableAttributes": ["lang", "ref_id", "created"],
                "sortableAttributes": ["created"]
            }),
        ),
    ] {
        if client
            .request(Method::GET, &format!("/indexes/{uid}"))
            .await
            .is_ok()
        {
            continue;
        }
        client.create_index(uid, "id").await?;
        client
            .request_task(
                Method::PATCH,
                &format!("/indexes/{uid}/settings"),
                &settings,
            )
            .await?;
        tracing::info!(index_uid = uid, "已创建 Meilisearch 受管索引及默认配置");
    }
    Ok(())
}

/// 返回维护任务集合，供管理 API 复用。
pub fn task_collection(state: &SharedState) -> Collection<SearchMaintenanceTask> {
    state.db.collection(TASK_COLLECTION)
}

/// 执行蓝绿索引重建：临时索引准备完成后一次性交换，不中断正常查询。
async fn execute_rebuild(state: SharedState, task_id: ObjectId) {
    if let Err(error) = run_rebuild(&state, task_id).await {
        let status = if is_cancel_requested(&state, task_id).await {
            "canceled"
        } else {
            "failed"
        };
        let message = error_message(&error);
        let _ = task_collection(&state)
            .update_one(
                doc! { "_id": task_id },
                doc! { "$set": {
                    "status": status,
                    "phase": status,
                    "error": &message,
                    "updatedAt": DateTime::now(),
                    "finishedAt": DateTime::now(),
                }, "$push": { "logs": message } },
            )
            .await;
        tracing::error!(task_id = %task_id, ?error, "Meilisearch 索引重建失败");
        cleanup_temporary_indexes(&state, task_id).await;
    }
}

/// 完成单次重建的各个可取消阶段。
async fn run_rebuild(state: &SharedState, task_id: ObjectId) -> AppResult<()> {
    update_task(
        state,
        task_id,
        "running",
        "preparing",
        5,
        "开始准备临时索引",
    )
    .await?;
    ensure_not_canceled(state, task_id).await?;

    let suffix = task_id.to_hex();
    let temp_posts = format!("posts__rebuild_{suffix}");
    let temp_notes = format!("notes__rebuild_{suffix}");
    let client = MeilisearchAdminClient::from_state(state);
    client.create_index(&temp_posts, "id").await?;
    client.create_index(&temp_notes, "id").await?;

    copy_settings(&client, "posts", &temp_posts).await?;
    copy_settings(&client, "notes", &temp_notes).await?;
    update_task(
        state,
        task_id,
        "running",
        "collecting",
        20,
        "临时索引与配置已就绪",
    )
    .await?;
    ensure_not_canceled(state, task_id).await?;

    let post_documents = collect_post_documents(state)
        .await
        .map_err(|error| AppError::Internal(format!("构建文章文档失败: {error}")))?;
    let post_count = post_documents.len();
    client
        .request_task(
            Method::POST,
            &format!("/indexes/{temp_posts}/documents?primaryKey=id"),
            &post_documents,
        )
        .await?;
    update_task(
        state,
        task_id,
        "running",
        "indexing_notes",
        55,
        &format!("已写入 {post_count} 条文章搜索文档"),
    )
    .await?;
    ensure_not_canceled(state, task_id).await?;

    let note_documents = collect_note_documents(state)
        .await
        .map_err(|error| AppError::Internal(format!("构建笔记文档失败: {error}")))?;
    let note_count = note_documents.len();
    client
        .request_task(
            Method::POST,
            &format!("/indexes/{temp_notes}/documents?primaryKey=id"),
            &note_documents,
        )
        .await?;
    update_task(
        state,
        task_id,
        "running",
        "swapping",
        85,
        &format!("已写入 {note_count} 条笔记搜索文档，准备切换索引"),
    )
    .await?;
    ensure_not_canceled(state, task_id).await?;

    client
        .request_task(
            Method::POST,
            "/swap-indexes",
            &json!([
                { "indexes": ["posts", temp_posts] },
                { "indexes": ["notes", temp_notes] }
            ]),
        )
        .await?;
    update_task(
        state,
        task_id,
        "running",
        "cleanup",
        95,
        "线上索引已原子切换",
    )
    .await?;

    // 交换后临时名称指向旧索引，清理失败不影响已切换的搜索服务。
    if let Err(error) = client.delete_index(&temp_posts).await {
        append_log(state, task_id, &format!("清理旧文章索引失败: {error:?}")).await;
    }
    if let Err(error) = client.delete_index(&temp_notes).await {
        append_log(state, task_id, &format!("清理旧笔记索引失败: {error:?}")).await;
    }

    task_collection(state)
        .update_one(
            doc! { "_id": task_id },
            doc! { "$set": {
                "status": "succeeded",
                "phase": "completed",
                "progress": 100,
                "updatedAt": DateTime::now(),
                "finishedAt": DateTime::now(),
            }, "$push": { "logs": "索引重建完成" } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(())
}

/// 将线上索引完整配置复制到临时索引，保留 Embedders 与未来新增参数。
async fn copy_settings(
    client: &MeilisearchAdminClient,
    source: &str,
    target: &str,
) -> AppResult<()> {
    let settings = match client
        .request(Method::GET, &format!("/indexes/{source}/settings"))
        .await
    {
        Ok(settings) => settings,
        Err(_) => Value::Object(Default::default()),
    };
    client
        .request_task(
            Method::PATCH,
            &format!("/indexes/{target}/settings"),
            &settings,
        )
        .await?;
    Ok(())
}

/// 更新任务进度并追加阶段日志。
async fn update_task(
    state: &SharedState,
    task_id: ObjectId,
    status: &str,
    phase: &str,
    progress: i32,
    log: &str,
) -> AppResult<()> {
    let now = DateTime::now();
    let mut set_fields = doc! {
        "status": status,
        "phase": phase,
        "progress": progress,
        "updatedAt": now,
    };
    if progress == 5 {
        set_fields.insert("startedAt", now);
    }
    task_collection(state)
        .update_one(
            doc! { "_id": task_id },
            doc! { "$set": set_fields, "$push": { "logs": log } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(())
}

/// 清理失败或取消任务遗留的临时索引。
async fn cleanup_temporary_indexes(state: &SharedState, task_id: ObjectId) {
    let client = MeilisearchAdminClient::from_state(state);
    let suffix = task_id.to_hex();
    for uid in [
        format!("posts__rebuild_{suffix}"),
        format!("notes__rebuild_{suffix}"),
    ] {
        if client
            .request(Method::GET, &format!("/indexes/{uid}"))
            .await
            .is_ok()
        {
            let _ = client.delete_index(&uid).await;
        }
    }
}

/// 追加不影响主流程的诊断日志。
async fn append_log(state: &SharedState, task_id: ObjectId, log: &str) {
    let _ = task_collection(state)
        .update_one(
            doc! { "_id": task_id },
            doc! { "$set": { "updatedAt": DateTime::now() }, "$push": { "logs": log } },
        )
        .await;
}

/// 检查管理员是否请求取消当前任务。
async fn is_cancel_requested(state: &SharedState, task_id: ObjectId) -> bool {
    task_collection(state)
        .find_one(doc! { "_id": task_id })
        .await
        .ok()
        .flatten()
        .is_some_and(|task| task.cancel_requested)
}

/// 在阶段边界响应取消请求，避免在线上索引切换后产生半完成状态。
async fn ensure_not_canceled(state: &SharedState, task_id: ObjectId) -> AppResult<()> {
    if is_cancel_requested(state, task_id).await {
        return Err(AppError::BadRequest("任务已由管理员取消".to_string()));
    }
    Ok(())
}

/// 生成适合持久化到任务日志的错误信息。
fn error_message(error: &AppError) -> String {
    format!("{error:?}")
}
