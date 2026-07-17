//! Meilisearch 索引重建任务与定时调度。

use bson::{DateTime, doc, oid::ObjectId};
use mongodb::Collection;
use reqwest::Method;
use serde_json::json;

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    external::meilisearch_admin::MeilisearchAdminClient,
    models::SearchMaintenanceTask,
    tasks::search_vector_config::{
        apply_vector_config_to_all_indexes, load_or_infer_vector_config,
    },
};

const TASK_COLLECTION: &str = "search_maintenance_tasks";
mod cleanup;
mod rebuild;
mod scheduler;

use cleanup::cleanup_temporary_indexes;
pub use scheduler::{default_schedule, schedule_collection, start_search_maintenance_scheduler};

/// 后端重启后收敛无法继续执行的旧任务，并异步清理历史临时索引。
pub async fn recover_interrupted_rebuilds(state: &SharedState) -> AppResult<()> {
    let now = DateTime::now();
    let interruption_message = "后端进程已重启，原重建执行器无法恢复，任务已自动终止";
    let result = task_collection(state)
        .update_many(
            doc! { "status": { "$in": ["queued", "running"] } },
            doc! { "$set": {
                "status": "failed",
                "phase": "interrupted",
                "error": interruption_message,
                "updatedAt": now,
                "finishedAt": now,
            }, "$push": { "logs": interruption_message } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    if result.modified_count > 0 {
        tracing::warn!(
            interrupted_tasks = result.modified_count,
            "已收敛后端重启前未结束的 Meilisearch 重建任务"
        );
    }
    Ok(())
}

/// 清理所有不再属于当前执行器的重建临时索引。
pub async fn cleanup_orphaned_rebuild_indexes(state: &SharedState) -> AppResult<usize> {
    cleanup::cleanup_orphaned_temporary_indexes(state).await
}

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
    let vector_config = load_or_infer_vector_config(&state.db, &client).await?;
    apply_vector_config_to_all_indexes(&client, &vector_config).await?;
    Ok(())
}

/// 返回维护任务集合，供管理 API 复用。
pub fn task_collection(state: &SharedState) -> Collection<SearchMaintenanceTask> {
    state.db.collection(TASK_COLLECTION)
}

/// 同时匹配新版 ObjectId 与旧版字符串主键。
pub fn task_id_filter(task_id: ObjectId) -> bson::Document {
    doc! { "_id": { "$in": [task_id, task_id.to_hex()] } }
}

/// 执行蓝绿索引重建：临时索引准备完成后一次性交换，不中断正常查询。
async fn execute_rebuild(state: SharedState, task_id: ObjectId) {
    if let Err(error) = rebuild::run_rebuild(&state, task_id).await {
        let status = if is_cancel_requested(&state, task_id).await {
            "canceled"
        } else {
            "failed"
        };
        let message = error_message(&error);
        let _ = task_collection(&state)
            .update_one(
                task_id_filter(task_id),
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
        if let Err(cleanup_error) = cleanup_temporary_indexes(&state, task_id).await {
            tracing::error!(task_id = %task_id, ?cleanup_error, "Meilisearch 重建失败后的临时索引清理仍未完成");
        }
    }
}

/// 更新任务进度并追加阶段日志。
pub(super) async fn update_task(
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
            task_id_filter(task_id),
            doc! { "$set": set_fields, "$push": { "logs": log } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(())
}

/// 检查管理员是否请求取消当前任务。
async fn is_cancel_requested(state: &SharedState, task_id: ObjectId) -> bool {
    task_collection(state)
        .find_one(task_id_filter(task_id))
        .await
        .ok()
        .flatten()
        .is_some_and(|task| task.cancel_requested)
}

/// 在阶段边界响应取消请求，避免在线上索引切换后产生半完成状态。
pub(super) async fn ensure_not_canceled(state: &SharedState, task_id: ObjectId) -> AppResult<()> {
    if is_cancel_requested(state, task_id).await {
        return Err(AppError::BadRequest("任务已由管理员取消".to_string()));
    }
    Ok(())
}

/// 生成适合持久化到任务日志的错误信息。
fn error_message(error: &AppError) -> String {
    format!("{error:?}")
}
