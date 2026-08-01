//! Meilisearch 重建任务、失败重试、取消与定时计划接口。

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{DateTime, doc, oid::ObjectId};
use futures::TryStreamExt;

/// 重建任务超过该时长未更新视为僵尸：spawn 的执行器已失活（panic 或被卡死），
/// DB 状态永远不会自行收敛，必须由后台主动回收，否则新重建会被永久阻塞。
const ZOMBIE_THRESHOLD_SECS: i64 = 25 * 60;
/// 取消请求时若任务已沉默该时长，立即把状态置为 canceled 以解除阻塞；
/// 重建执行器在下一个阶段边界仍会通过 cancelRequested 安全终止，不会发生半切换。
const CANCEL_FORCE_SILENCE_SECS: i64 = 2 * 60;

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::{
        ApiResponse, SearchMaintenanceSchedule, SearchMaintenanceScheduleResponse,
        SearchMaintenanceTaskResponse, SearchSyncEventResponse, UpdateSearchMaintenanceSchedule,
    },
    tasks::meilisearch_incremental::{event_collection, event_id_filter},
    tasks::search_maintenance::{
        default_schedule, enqueue_rebuild, schedule_collection, task_collection, task_id_filter,
    },
};

/// 列出最近的后台索引维护任务。
pub async fn list_maintenance_tasks(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<SearchMaintenanceTaskResponse>>>> {
    let tasks = task_collection(&state)
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(Json(ApiResponse::success(
        tasks
            .into_iter()
            .map(SearchMaintenanceTaskResponse::from)
            .collect(),
    )))
}

/// 列出最近的持久化增量同步事件，便于观察失败重试状态。
pub async fn list_sync_events(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<SearchSyncEventResponse>>>> {
    let events = event_collection(&state)
        .find(doc! {})
        .sort(doc! { "createdAt": -1 })
        .limit(100)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(Json(ApiResponse::success(
        events
            .into_iter()
            .map(SearchSyncEventResponse::from)
            .collect(),
    )))
}

/// 立即重试一个失败的增量同步事件。
pub async fn retry_sync_event(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(event_id): Path<String>,
) -> AppResult<Json<ApiResponse<SearchSyncEventResponse>>> {
    let event_id = parse_task_id(&event_id)?;
    let collection = event_collection(&state);
    collection
        .update_one(
            event_id_filter(event_id),
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
        .find_one(event_id_filter(event_id))
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("增量同步事件不存在".to_string()))?;
    Ok(Json(ApiResponse::success(SearchSyncEventResponse::from(
        event,
    ))))
}

/// 手动创建索引重建任务。
pub async fn create_rebuild(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<SearchMaintenanceTaskResponse>>> {
    ensure_no_active_task(&state).await?;
    let task = enqueue_rebuild(state, false, None).await?;
    Ok(Json(ApiResponse::success(
        SearchMaintenanceTaskResponse::from(task),
    )))
}

/// 从失败或取消的任务创建一次全新重试。
pub async fn retry_rebuild(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(task_id): Path<String>,
) -> AppResult<Json<ApiResponse<SearchMaintenanceTaskResponse>>> {
    ensure_no_active_task(&state).await?;
    let source_id = parse_task_id(&task_id)?;
    let source = task_collection(&state)
        .find_one(task_id_filter(source_id))
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("维护任务不存在".to_string()))?;
    if !matches!(source.status.as_str(), "failed" | "canceled") {
        return Err(AppError::BadRequest(
            "仅失败或已取消的任务可以重试".to_string(),
        ));
    }
    let task = enqueue_rebuild(state, false, Some(source_id)).await?;
    Ok(Json(ApiResponse::success(
        SearchMaintenanceTaskResponse::from(task),
    )))
}

/// 请求取消任务；执行器会在下一阶段边界停止，线上索引不会处于半切换状态。
pub async fn cancel_rebuild(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(task_id): Path<String>,
) -> AppResult<Json<ApiResponse<SearchMaintenanceTaskResponse>>> {
    let task_id = parse_task_id(&task_id)?;
    let collection = task_collection(&state);
    let Some(task) = collection
        .find_one(task_id_filter(task_id))
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    else {
        return Err(AppError::NotFound("维护任务不存在".to_string()));
    };
    if !matches!(task.status.as_str(), "queued" | "running") {
        return Err(AppError::BadRequest("当前任务状态不可取消".to_string()));
    }
    // 始终置 cancelRequested，让执行器在下一阶段边界安全终止（swap 前有 ensure_not_canceled 守卫）。
    // 若任务已沉默超过阈值，说明执行器已卡在长耗时步骤（如向量化）或已失活，
    // 立即将状态置为 canceled 解除对新重建的阻塞；执行器后续恢复时仍会因 cancelRequested 而不再 swap。
    let now = DateTime::now();
    let force_complete = task.updated_at.timestamp_millis()
        < now.timestamp_millis() - CANCEL_FORCE_SILENCE_SECS * 1000;
    let mut set_fields = doc! {
        "cancelRequested": true,
        "updatedAt": now,
    };
    let mut push_log = "管理员已请求取消任务";
    if force_complete {
        set_fields.insert("status", "canceled");
        set_fields.insert("phase", "canceled");
        set_fields.insert("finishedAt", now);
        push_log = "任务长时间无更新，已强制标记为已取消以解除阻塞";
    }
    collection
        .update_one(
            task_id_filter(task_id),
            doc! { "$set": set_fields, "$push": { "logs": push_log } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let updated = collection
        .find_one(task_id_filter(task_id))
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("维护任务不存在".to_string()))?;
    Ok(Json(ApiResponse::success(
        SearchMaintenanceTaskResponse::from(updated),
    )))
}

/// 删除单条已结束的重建任务记录；运行中的任务必须先取消。
pub async fn delete_rebuild_task(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(task_id): Path<String>,
) -> AppResult<Json<ApiResponse<u64>>> {
    let task_id = parse_task_id(&task_id)?;
    let collection = task_collection(&state);
    let task = collection
        .find_one(task_id_filter(task_id))
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("维护任务不存在".to_string()))?;
    if matches!(task.status.as_str(), "queued" | "running") {
        return Err(AppError::BadRequest(
            "运行中的任务不可删除，请先取消".to_string(),
        ));
    }
    let result = collection
        .delete_one(task_id_filter(task_id))
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(Json(ApiResponse::success(result.deleted_count)))
}

/// 清理全部已结束（成功/失败/取消）的重建任务记录，保留运行中任务。
pub async fn clear_finished_rebuild_tasks(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<u64>>> {
    let result = task_collection(&state)
        .delete_many(doc! {
            "status": { "$in": ["succeeded", "failed", "canceled"] },
        })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(Json(ApiResponse::success(result.deleted_count)))
}

/// 获取索引定时重建计划。
pub async fn get_schedule(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<SearchMaintenanceScheduleResponse>>> {
    let schedule = schedule_collection(&state)
        .find_one(doc! { "_id": "meilisearch-rebuild" })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .unwrap_or_else(default_schedule);
    Ok(Json(ApiResponse::success(
        SearchMaintenanceScheduleResponse::from(schedule),
    )))
}

/// 更新索引定时重建计划。
pub async fn update_schedule(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<UpdateSearchMaintenanceSchedule>,
) -> AppResult<Json<ApiResponse<SearchMaintenanceScheduleResponse>>> {
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
    Ok(Json(ApiResponse::success(
        SearchMaintenanceScheduleResponse::from(schedule),
    )))
}

/// 阻止多个重建任务并发写入和交换同一组索引。
///
/// 先回收僵尸任务：执行器 spawn 失活（panic）或卡在无超时的外部调用后，
/// DB 状态会永久停在 running/queued，必须由这里主动收敛，否则新重建被永久阻塞。
async fn ensure_no_active_task(state: &SharedState) -> AppResult<()> {
    sweep_zombie_tasks(state).await?;
    let active_count = task_collection(state)
        .count_documents(doc! { "status": { "$in": ["queued", "running"] } })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    if active_count > 0 {
        return Err(AppError::BadRequest("已有索引重建任务正在执行".to_string()));
    }
    Ok(())
}

/// 把超过 ZOMBIE_THRESHOLD 未更新的 running/queued 任务标记为失败。
///
/// 阈值大于单批次最长等待（20 分钟）+ Meilisearch embedding 超时（约 13 分钟），
/// 因此正常任务不会被误判；只有执行器已失活或被无限挂起的任务才会被回收。
async fn sweep_zombie_tasks(state: &SharedState) -> AppResult<()> {
    let now = DateTime::now();
    let cutoff = DateTime::from_millis(now.timestamp_millis() - ZOMBIE_THRESHOLD_SECS * 1000);
    let message = "任务长时间无更新，判定为僵尸任务并已自动回收";
    let result = task_collection(state)
        .update_many(
            doc! {
                "status": { "$in": ["queued", "running"] },
                "updatedAt": { "$lt": cutoff },
            },
            doc! { "$set": {
                "status": "failed",
                "phase": "zombie",
                "error": message,
                "updatedAt": now,
                "finishedAt": now,
            }, "$push": { "logs": message } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    if result.modified_count > 0 {
        tracing::warn!(
            recovered = result.modified_count,
            "已回收卡死的 Meilisearch 重建僵尸任务"
        );
    }
    Ok(())
}

/// 解析并校验维护任务主键。
fn parse_task_id(task_id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(task_id).map_err(|_| AppError::BadRequest("维护任务 ID 无效".to_string()))
}
