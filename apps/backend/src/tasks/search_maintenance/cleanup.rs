//! Meilisearch 蓝绿重建临时索引清理。

use bson::{DateTime, doc, oid::ObjectId};
use serde_json::Value;

use crate::{
    app::SharedState, error::AppResult, external::meilisearch_admin::MeilisearchAdminClient,
    tasks::search_vector_config::is_rebuild_index,
};

use super::{task_collection, task_id_filter};

/// 清理失败或取消任务遗留的临时索引，并保留失败原因供后台诊断。
pub(super) async fn cleanup_temporary_indexes(
    state: &SharedState,
    task_id: ObjectId,
) -> AppResult<usize> {
    let client = MeilisearchAdminClient::from_state(state);
    let suffix = format!("__rebuild_{}", task_id.to_hex());
    let index_uids = match list_temporary_indexes(&client).await {
        Ok(index_uids) => index_uids,
        Err(error) => {
            append_log(state, task_id, &format!("枚举临时索引失败: {error:?}")).await;
            return Err(error);
        }
    };
    let mut cleaned_count = 0;
    for uid in index_uids.into_iter().filter(|uid| uid.ends_with(&suffix)) {
        if let Err(error) = client.delete_index(&uid).await {
            let message = format!("清理临时索引 {uid} 失败: {error:?}");
            tracing::warn!(task_id = %task_id, index_uid = uid, ?error, "清理重建临时索引失败");
            append_log(state, task_id, &message).await;
            return Err(error);
        }
        cleaned_count += 1;
    }
    Ok(cleaned_count)
}

/// 新任务开始前清除所有历史临时索引，失败时阻止继续制造新残留。
pub(super) async fn cleanup_orphaned_temporary_indexes(state: &SharedState) -> AppResult<usize> {
    let client = MeilisearchAdminClient::from_state(state);
    let index_uids = list_temporary_indexes(&client).await?;
    for uid in &index_uids {
        client.delete_index(uid).await?;
        tracing::info!(index_uid = uid, "已清理历史重建临时索引");
    }
    Ok(index_uids.len())
}

/// 枚举全部重建临时索引。
async fn list_temporary_indexes(client: &MeilisearchAdminClient) -> AppResult<Vec<String>> {
    Ok(client
        .list_all_indexes()
        .await?
        .iter()
        .filter_map(|index| index.get("uid").and_then(Value::as_str))
        .filter(|uid| is_rebuild_index(uid))
        .map(ToString::to_string)
        .collect())
}

/// 追加不影响主流程的清理诊断日志。
pub(super) async fn append_log(state: &SharedState, task_id: ObjectId, log: &str) {
    let _ = task_collection(state)
        .update_one(
            task_id_filter(task_id),
            doc! { "$set": { "updatedAt": DateTime::now() }, "$push": { "logs": log } },
        )
        .await;
}
