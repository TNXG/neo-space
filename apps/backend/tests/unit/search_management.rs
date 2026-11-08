use bson::{Bson, doc, oid::ObjectId};

use super::{SearchMaintenanceTask, SearchMaintenanceTaskResponse};

/// 验证持久化模型使用 MongoDB 原生类型。
#[test]
fn maintenance_task_persists_native_bson_types() -> Result<(), Box<dyn std::error::Error>> {
    let task = SearchMaintenanceTask::queued(false, None);
    let document = bson::to_document(&task)?;

    assert!(matches!(document.get("_id"), Some(Bson::ObjectId(_))));
    assert!(matches!(document.get("createdAt"), Some(Bson::DateTime(_))));
    assert!(matches!(document.get("updatedAt"), Some(Bson::DateTime(_))));
    Ok(())
}

/// 验证旧版字符串主键和日期仍可被读取。
#[test]
fn maintenance_task_reads_legacy_string_values() -> Result<(), Box<dyn std::error::Error>> {
    let task_id = ObjectId::new();
    let document = doc! {
        "_id": task_id.to_hex(),
        "kind": "rebuild",
        "status": "failed",
        "phase": "failed",
        "progress": 5,
        "logs": ["历史任务"],
        "error": null,
        "cancelRequested": false,
        "scheduled": false,
        "sourceTaskId": null,
        "createdAt": "2026-07-17T05:38:27Z",
        "updatedAt": "2026-07-17T05:38:28Z",
        "startedAt": null,
        "finishedAt": "2026-07-17T05:38:29Z",
    };

    let task: SearchMaintenanceTask = bson::from_document(document)?;

    assert_eq!(task.id, task_id);
    assert!(task.finished_at.is_some());
    Ok(())
}

/// 验证 HTTP 响应继续输出字符串主键和 ISO 日期。
#[test]
fn maintenance_task_response_preserves_api_contract() -> Result<(), Box<dyn std::error::Error>> {
    let task = SearchMaintenanceTask::queued(false, None);
    let task_id = task.id.to_hex();
    let response = serde_json::to_value(SearchMaintenanceTaskResponse::from(task))?;

    assert_eq!(
        response.get("_id").and_then(|value| value.as_str()),
        Some(task_id.as_str())
    );
    assert!(
        response
            .get("createdAt")
            .and_then(|value| value.as_str())
            .is_some()
    );
    assert!(
        response
            .get("updatedAt")
            .and_then(|value| value.as_str())
            .is_some()
    );
    Ok(())
}
