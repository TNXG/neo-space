//! Meilisearch 定时维护计划检查器。

use std::time::Duration;

use bson::{DateTime, doc};
use mongodb::Collection;

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::SearchMaintenanceSchedule,
};

use super::{enqueue_rebuild, task_collection};

const SCHEDULE_COLLECTION: &str = "search_maintenance_schedules";
const SCHEDULE_ID: &str = "meilisearch-rebuild";

/// 启动轻量定时器；仅在计划到期时创建维护任务，应用启动不会重建索引。
pub fn start_search_maintenance_scheduler(state: SharedState) {
    let startup_cutoff = DateTime::now();
    tokio::spawn(async move {
        mark_interrupted_tasks(&state, startup_cutoff).await;
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            if let Err(error) = enqueue_scheduled_rebuild_if_due(&state).await {
                tracing::warn!(?error, "检查 Meilisearch 定时重建计划失败");
            }
        }
    });
}

/// 返回计划配置集合，供管理 API 复用。
pub fn schedule_collection(state: &SharedState) -> Collection<SearchMaintenanceSchedule> {
    state.db.collection(SCHEDULE_COLLECTION)
}

/// 返回默认维护计划。
pub fn default_schedule() -> SearchMaintenanceSchedule {
    SearchMaintenanceSchedule {
        id: SCHEDULE_ID.to_string(),
        enabled: false,
        interval_hours: 24,
        next_run_at: None,
        updated_at: DateTime::now(),
    }
}

/// 将进程重启时遗留的任务标记失败，允许管理员明确重试。
async fn mark_interrupted_tasks(state: &SharedState, startup_cutoff: DateTime) {
    let now = DateTime::now();
    let _ = task_collection(state)
        .update_many(
            doc! {
                "status": { "$in": ["queued", "running"] },
                "updatedAt": { "$lt": startup_cutoff },
            },
            doc! { "$set": {
                "status": "failed",
                "phase": "interrupted",
                "error": "应用重启导致任务中断",
                "updatedAt": now,
                "finishedAt": now,
            }, "$push": { "logs": "应用重启，任务执行上下文已丢失" } },
        )
        .await;
}

/// 检查到期计划并避免与正在执行的维护任务重叠。
async fn enqueue_scheduled_rebuild_if_due(state: &SharedState) -> AppResult<()> {
    let schedules = schedule_collection(state);
    let Some(schedule) = schedules
        .find_one(doc! { "_id": SCHEDULE_ID })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    else {
        return Ok(());
    };
    let now = DateTime::now();
    if !schedule.enabled || schedule.next_run_at.is_none_or(|next| next > now) {
        return Ok(());
    }
    let active_count = task_collection(state)
        .count_documents(doc! { "status": { "$in": ["queued", "running"] } })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let next_run =
        DateTime::from_millis(now.timestamp_millis() + schedule.interval_hours.max(1) * 3_600_000);
    schedules
        .update_one(
            doc! { "_id": SCHEDULE_ID, "nextRunAt": { "$lte": now } },
            doc! { "$set": { "nextRunAt": next_run, "updatedAt": now } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    if active_count == 0 {
        enqueue_rebuild(state.clone(), true, None).await?;
    }
    Ok(())
}
