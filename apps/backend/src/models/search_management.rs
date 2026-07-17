//! Meilisearch 后台维护任务与计划配置模型。

use bson::{DateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// 索引重建任务的持久化状态。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMaintenanceTask {
    #[serde(rename = "_id")]
    #[serde(serialize_with = "crate::models::serializers::serialize_object_id")]
    pub id: ObjectId,
    pub kind: String,
    pub status: String,
    pub phase: String,
    pub progress: i32,
    pub logs: Vec<String>,
    pub error: Option<String>,
    pub cancel_requested: bool,
    pub scheduled: bool,
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_object_id")]
    pub source_task_id: Option<ObjectId>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub created_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub updated_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_datetime")]
    pub started_at: Option<DateTime>,
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_datetime")]
    pub finished_at: Option<DateTime>,
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
    #[serde(serialize_with = "crate::models::serializers::serialize_optional_datetime")]
    pub next_run_at: Option<DateTime>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub updated_at: DateTime,
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
    #[serde(serialize_with = "crate::models::serializers::serialize_object_id")]
    pub id: ObjectId,
    pub entity_type: String,
    pub ref_id: String,
    pub status: String,
    pub attempts: i32,
    pub last_error: Option<String>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub next_attempt_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub created_at: DateTime,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub updated_at: DateTime,
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
