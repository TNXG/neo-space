//! Meilisearch 后台维护任务与计划配置模型。

use bson::{DateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// 索引重建任务的持久化状态。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMaintenanceTask {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub kind: String,
    pub status: String,
    pub phase: String,
    pub progress: i32,
    pub logs: Vec<String>,
    pub error: Option<String>,
    pub cancel_requested: bool,
    pub scheduled: bool,
    pub source_task_id: Option<ObjectId>,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    pub created_at: DateTime,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    pub updated_at: DateTime,
    #[serde(
        default,
        deserialize_with = "crate::models::serializers::deserialize_flexible_optional_datetime"
    )]
    pub started_at: Option<DateTime>,
    #[serde(
        default,
        deserialize_with = "crate::models::serializers::deserialize_flexible_optional_datetime"
    )]
    pub finished_at: Option<DateTime>,
}

/// 提供给管理后台的索引重建任务响应。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMaintenanceTaskResponse {
    #[serde(rename = "_id")]
    #[serde(serialize_with = "crate::models::serializers::serialize_object_id")]
    id: ObjectId,
    kind: String,
    status: String,
    phase: String,
    progress: i32,
    logs: Vec<String>,
    error: Option<String>,
    cancel_requested: bool,
    scheduled: bool,
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_object_id")]
    source_task_id: Option<ObjectId>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    created_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    updated_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_datetime")]
    started_at: Option<DateTime>,
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_datetime")]
    finished_at: Option<DateTime>,
}

impl From<SearchMaintenanceTask> for SearchMaintenanceTaskResponse {
    /// 将数据库模型转换为稳定的 HTTP 响应模型。
    fn from(task: SearchMaintenanceTask) -> Self {
        Self {
            id: task.id,
            kind: task.kind,
            status: task.status,
            phase: task.phase,
            progress: task.progress,
            logs: task.logs,
            error: task.error,
            cancel_requested: task.cancel_requested,
            scheduled: task.scheduled,
            source_task_id: task.source_task_id,
            created_at: task.created_at,
            updated_at: task.updated_at,
            started_at: task.started_at,
            finished_at: task.finished_at,
        }
    }
}

impl SearchMaintenanceTask {
    /// 创建一个等待后台执行的索引重建任务。
    pub fn queued(scheduled: bool, source_task_id: Option<ObjectId>) -> Self {
        let now = DateTime::now();
        Self {
            id: ObjectId::new(),
            kind: "rebuild".to_string(),
            status: "queued".to_string(),
            phase: "queued".to_string(),
            progress: 0,
            logs: vec!["任务已进入等待队列".to_string()],
            error: None,
            cancel_requested: false,
            scheduled,
            source_task_id,
            created_at: now,
            updated_at: now,
            started_at: None,
            finished_at: None,
        }
    }
}

/// 定时重建配置；当前使用小时级间隔，后续可平滑扩展为 Cron 表达式。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMaintenanceSchedule {
    #[serde(rename = "_id")]
    pub id: String,
    pub enabled: bool,
    pub interval_hours: i64,
    #[serde(
        default,
        deserialize_with = "crate::models::serializers::deserialize_flexible_optional_datetime"
    )]
    pub next_run_at: Option<DateTime>,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    pub updated_at: DateTime,
}

/// 提供给管理后台的定时重建配置响应。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMaintenanceScheduleResponse {
    #[serde(rename = "_id")]
    id: String,
    enabled: bool,
    interval_hours: i64,
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_datetime")]
    next_run_at: Option<DateTime>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    updated_at: DateTime,
}

impl From<SearchMaintenanceSchedule> for SearchMaintenanceScheduleResponse {
    /// 将数据库计划转换为稳定的 HTTP 响应模型。
    fn from(schedule: SearchMaintenanceSchedule) -> Self {
        Self {
            id: schedule.id,
            enabled: schedule.enabled,
            interval_hours: schedule.interval_hours,
            next_run_at: schedule.next_run_at,
            updated_at: schedule.updated_at,
        }
    }
}

/// 更新定时维护计划的请求。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSearchMaintenanceSchedule {
    pub enabled: bool,
    pub interval_hours: i64,
}

/// 数据库内容变化对应的持久化增量同步事件。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSyncEvent {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub entity_type: String,
    pub ref_id: String,
    pub status: String,
    pub attempts: i32,
    pub last_error: Option<String>,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    pub next_attempt_at: DateTime,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    pub created_at: DateTime,
    #[serde(deserialize_with = "crate::models::serializers::deserialize_flexible_datetime")]
    pub updated_at: DateTime,
}

/// 提供给管理后台的增量同步事件响应。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSyncEventResponse {
    #[serde(rename = "_id")]
    #[serde(serialize_with = "crate::models::serializers::serialize_object_id")]
    id: ObjectId,
    entity_type: String,
    ref_id: String,
    status: String,
    attempts: i32,
    last_error: Option<String>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    next_attempt_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    created_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    updated_at: DateTime,
}

impl From<SearchSyncEvent> for SearchSyncEventResponse {
    /// 将数据库事件转换为稳定的 HTTP 响应模型。
    fn from(event: SearchSyncEvent) -> Self {
        Self {
            id: event.id,
            entity_type: event.entity_type,
            ref_id: event.ref_id,
            status: event.status,
            attempts: event.attempts,
            last_error: event.last_error,
            next_attempt_at: event.next_attempt_at,
            created_at: event.created_at,
            updated_at: event.updated_at,
        }
    }
}

impl SearchSyncEvent {
    /// 创建等待增量同步工作器处理的变更事件。
    pub fn pending(entity_type: &str, ref_id: &str) -> Self {
        let now = DateTime::now();
        Self {
            id: ObjectId::new(),
            entity_type: entity_type.to_string(),
            ref_id: ref_id.to_string(),
            status: "pending".to_string(),
            attempts: 0,
            last_error: None,
            next_attempt_at: now,
            created_at: now,
            updated_at: now,
        }
    }
}

#[cfg(test)]
#[path = "../../tests/unit/search_management.rs"]
mod tests;
