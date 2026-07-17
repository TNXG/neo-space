//! Meilisearch 重建任务、失败重试、取消与定时计划接口。

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{DateTime, doc, oid::ObjectId};
use futures::TryStreamExt;

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::{
        ApiResponse, SearchMaintenanceSchedule, SearchMaintenanceTask, SearchSyncEvent,
        UpdateSearchMaintenanceSchedule,
    },
    tasks::meilisearch_incremental::event_collection,
    tasks::search_maintenance::{
        default_schedule, enqueue_rebuild, schedule_collection, task_collection,
    },
};

/// 列出最近的后台索引维护任务。
pub async fn list_maintenance_tasks(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<SearchMaintenanceTask>>>> {
    let tasks = task_collection(&state)
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(Json(ApiResponse::success(tasks)))
}

/// 列出最近的持久化增量同步事件，便于观察失败重试状态。
pub async fn list_sync_events(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<SearchSyncEvent>>>> {
    let events = event_collection(&state)
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(Json(ApiResponse::success(events)))
}

/// 立即重试一个失败的增量同步事件。
pub async fn retry_sync_event(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(event_id): Path<String>,
) -> AppResult<Json<ApiResponse<SearchSyncEvent>>> {
    let event_id = parse_task_id(&event_id)?;
    let collection = event_collection(&state);
    collection
        .update_one(
            doc! { "_id": event_id },
            doc! { "$set": {
                "status": "pending",
                "nextAttemptAt": DateTime::now(),
                "lastError": null,
                "updatedAt": DateTime::now(),
            } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let event = collection
        .find_one(doc! { "_id": event_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("增量同步事件不存在".to_string()))?;
    Ok(Json(ApiResponse::success(event)))
}

/// 手动创建索引重建任务。
pub async fn create_rebuild(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<SearchMaintenanceTask>>> {
    ensure_no_active_task(&state).await?;
    let task = enqueue_rebuild(state, false, None).await?;
    Ok(Json(ApiResponse::success(task)))
}

/// 从失败或取消的任务创建一次全新重试。
pub async fn retry_rebuild(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(task_id): Path<String>,
) -> AppResult<Json<ApiResponse<SearchMaintenanceTask>>> {
    ensure_no_active_task(&state).await?;
    let source_id = parse_task_id(&task_id)?;
    let source = task_collection(&state)
        .find_one(doc! { "_id": source_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("维护任务不存在".to_string()))?;
    if !matches!(source.status.as_str(), "failed" | "canceled") {
        return Err(AppError::BadRequest(
            "仅失败或已取消的任务可以重试".to_string(),
        ));
    }
    let task = enqueue_rebuild(state, false, Some(source_id)).await?;
    Ok(Json(ApiResponse::success(task)))
}

/// 请求取消任务；执行器会在下一阶段边界停止，线上索引不会处于半切换状态。
pub async fn cancel_rebuild(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(task_id): Path<String>,
) -> AppResult<Json<ApiResponse<SearchMaintenanceTask>>> {
    let task_id = parse_task_id(&task_id)?;
    let collection = task_collection(&state);
    let Some(task) = collection
        .find_one(doc! { "_id": task_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    else {
        return Err(AppError::NotFound("维护任务不存在".to_string()));
    };
    if !matches!(task.status.as_str(), "queued" | "running") {
        return Err(AppError::BadRequest("当前任务状态不可取消".to_string()));
    }
    collection
        .update_one(
            doc! { "_id": task_id },
            doc! { "$set": {
                "cancelRequested": true,
                "updatedAt": DateTime::now(),
            }, "$push": { "logs": "管理员已请求取消任务" } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let updated = collection
        .find_one(doc! { "_id": task_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("维护任务不存在".to_string()))?;
    Ok(Json(ApiResponse::success(updated)))
}

/// 获取索引定时重建计划。
pub async fn get_schedule(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<SearchMaintenanceSchedule>>> {
    let schedule = schedule_collection(&state)
        .find_one(doc! { "_id": "meilisearch-rebuild" })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .unwrap_or_else(default_schedule);
    Ok(Json(ApiResponse::success(schedule)))
}

/// 更新索引定时重建计划。
pub async fn update_schedule(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<UpdateSearchMaintenanceSchedule>,
) -> AppResult<Json<ApiResponse<SearchMaintenanceSchedule>>> {
    if !(1..=8760).contains(&payload.interval_hours) {
        return Err(AppError::BadRequest(
            "定时间隔必须在 1 到 8760 小时之间".to_string(),
        ));
    }
    let now = DateTime::now();
    let schedule = SearchMaintenanceSchedule {
        id: "meilisearch-rebuild".to_string(),
        enabled: payload.enabled,
        interval_hours: payload.interval_hours,
        next_run_at: payload.enabled.then(|| {
            DateTime::from_millis(now.timestamp_millis() + payload.interval_hours * 3_600_000)
        }),
        updated_at: now,
    };
    schedule_collection(&state)
        .replace_one(doc! { "_id": &schedule.id }, &schedule)
        .upsert(true)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(Json(ApiResponse::success(schedule)))
}

/// 阻止多个重建任务并发写入和交换同一组索引。
async fn ensure_no_active_task(state: &SharedState) -> AppResult<()> {
    let active_count = task_collection(state)
        .count_documents(doc! { "status": { "$in": ["queued", "running"] } })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    if active_count > 0 {
        return Err(AppError::BadRequest("已有索引重建任务正在执行".to_string()));
    }
    Ok(())
}

/// 解析并校验维护任务主键。
fn parse_task_id(task_id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(task_id).map_err(|_| AppError::BadRequest("维护任务 ID 无效".to_string()))
}
