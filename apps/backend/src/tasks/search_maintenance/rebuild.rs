//! 以 MongoDB 为受管内容事实源的 Meilisearch 蓝绿全量同步与重建。

use bson::{DateTime, doc, oid::ObjectId};
use reqwest::Method;
use serde::Serialize;
use serde_json::{Value, json};

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    external::meilisearch_admin::MeilisearchAdminClient,
    tasks::{
        meilisearch_sync::rebuild_documents::{collect_note_documents, collect_post_documents},
        search_vector_config::{
            is_rebuild_index, load_or_infer_vector_config, merge_vector_config_into_settings,
        },
    },
};

use super::{
    cleanup::{cleanup_orphaned_temporary_indexes, cleanup_temporary_indexes},
    ensure_not_canceled, task_collection, task_id_filter, update_task,
};

/// 单个正式索引及其本次重建临时索引。
struct RebuildIndex {
    uid: String,
    temporary_uid: String,
    primary_key: Option<String>,
}

/// 枚举并重建 Meilisearch 中全部正式索引。
pub(super) async fn run_rebuild(state: &SharedState, task_id: ObjectId) -> AppResult<()> {
    update_task(
        state,
        task_id,
        "running",
        "cleanup_orphans",
        2,
        "正在取消历史临时索引任务并清理残留",
    )
    .await?;
    let cleaned_indexes = cleanup_orphaned_temporary_indexes(state).await?;
    update_task(
        state,
        task_id,
        "running",
        "preparing",
        5,
        &format!("已清理 {cleaned_indexes} 个历史临时索引，开始枚举全部正式索引"),
    )
    .await?;
    ensure_not_canceled(state, task_id).await?;

    let client = MeilisearchAdminClient::from_state(state);
    let indexes = list_indexes(&client, task_id).await?;
    if indexes.is_empty() {
        return finish_rebuild(state, task_id, 0).await;
    }
    let vector_config = load_or_infer_vector_config(&state.db, &client).await?;
    for (position, index) in indexes.iter().enumerate() {
        ensure_not_canceled(state, task_id).await?;
        create_temporary_index(&client, index).await?;
        copy_settings(&client, index, &vector_config).await?;
        let document_count = rebuild_documents_from_source(state, &client, index).await?;
        let progress = 10 + i32::try_from(((position + 1) * 75) / indexes.len()).unwrap_or(75);
        update_task(
            state,
            task_id,
            "running",
            "indexing",
            progress,
            &format!(
                "已从事实源重建索引 {}，写入并向量化 {document_count} 条文档",
                index.uid
            ),
        )
        .await?;
    }

    ensure_not_canceled(state, task_id).await?;
    let swaps = indexes
        .iter()
        .map(|index| json!({ "indexes": [&index.uid, &index.temporary_uid] }))
        .collect::<Vec<_>>();
    client
        .request_task(Method::POST, "/swap-indexes", &swaps)
        .await?;
    update_task(
        state,
        task_id,
        "running",
        "cleanup",
        95,
        "全部正式索引已原子交换，正在清理旧索引",
    )
    .await?;
    cleanup_temporary_indexes(state, task_id).await?;
    finish_rebuild(state, task_id, indexes.len()).await
}

/// 枚举全部非临时 Meilisearch 索引。
async fn list_indexes(
    client: &MeilisearchAdminClient,
    task_id: ObjectId,
) -> AppResult<Vec<RebuildIndex>> {
    let results = client.list_all_indexes().await?;
    build_rebuild_indexes(&results, task_id)
}

/// 从 Meilisearch 索引列表生成本次全部重建目标。
fn build_rebuild_indexes(results: &[Value], task_id: ObjectId) -> AppResult<Vec<RebuildIndex>> {
    let suffix = task_id.to_hex();
    results
        .iter()
        .filter_map(|index| {
            let uid = index.get("uid")?.as_str()?;
            (!is_rebuild_index(uid)).then(|| RebuildIndex {
                uid: uid.to_string(),
                temporary_uid: format!("{uid}__rebuild_{suffix}"),
                primary_key: index
                    .get("primaryKey")
                    .and_then(Value::as_str)
                    .map(ToString::to_string),
            })
        })
        .map(|index| {
            if index.temporary_uid.len() > 400 {
                Err(AppError::BadRequest(format!(
                    "索引 {} 名称过长，无法生成重建临时索引",
                    index.uid
                )))
            } else {
                Ok(index)
            }
        })
        .collect()
}

/// 创建保留原主键的临时索引。
async fn create_temporary_index(
    client: &MeilisearchAdminClient,
    index: &RebuildIndex,
) -> AppResult<()> {
    let mut body = json!({ "uid": index.temporary_uid });
    if let (Some(body), Some(primary_key)) = (body.as_object_mut(), &index.primary_key) {
        body.insert("primaryKey".to_string(), json!(primary_key));
    }
    client.request_task(Method::POST, "/indexes", &body).await?;
    Ok(())
}

/// 复制完整索引设置，并以项目级向量策略覆盖 Embedder 公共参数。
async fn copy_settings(
    client: &MeilisearchAdminClient,
    index: &RebuildIndex,
    vector_config: &crate::models::SearchVectorConfig,
) -> AppResult<()> {
    let mut settings = client
        .request(Method::GET, &format!("/indexes/{}/settings", index.uid))
        .await?;
    merge_vector_config_into_settings(&mut settings, vector_config);
    client
        .request_task(
            Method::PATCH,
            &format!("/indexes/{}/settings", index.temporary_uid),
            &settings,
        )
        .await?;
    Ok(())
}

/// 按索引类型选择事实源；受管内容索引来自 MongoDB，其他索引保留原有文档。
async fn rebuild_documents_from_source(
    state: &SharedState,
    client: &MeilisearchAdminClient,
    index: &RebuildIndex,
) -> AppResult<usize> {
    match index.uid.as_str() {
        "posts" => {
            let documents = collect_post_documents(state).await?;
            upload_documents(client, index, &documents).await?;
            Ok(documents.len())
        }
        "notes" => {
            let documents = collect_note_documents(state).await?;
            upload_documents(client, index, &documents).await?;
            Ok(documents.len())
        }
        _ => copy_existing_documents(client, index).await,
    }
}

/// 分批写入搜索文档；等待 Meilisearch 完成任务也会等待 REST Embedder 向量化完成。
async fn upload_documents<T: Serialize>(
    client: &MeilisearchAdminClient,
    index: &RebuildIndex,
    documents: &[T],
) -> AppResult<()> {
    for batch in documents.chunks(1000) {
        client
            .request_task(
                Method::POST,
                &format!("/indexes/{}/documents", index.temporary_uid),
                batch,
            )
            .await?;
    }
    Ok(())
}

/// 未映射到 MongoDB 内容实体的自定义索引继续以原正式索引为数据源。
async fn copy_existing_documents(
    client: &MeilisearchAdminClient,
    index: &RebuildIndex,
) -> AppResult<usize> {
    let mut offset = 0_usize;
    loop {
        let page = client
            .request(
                Method::GET,
                &format!(
                    "/indexes/{}/documents?offset={offset}&limit=1000",
                    index.uid
                ),
            )
            .await?;
        let documents = page
            .get("results")
            .and_then(Value::as_array)
            .cloned()
            .ok_or_else(|| AppError::Internal(format!("索引 {} 文档响应格式无效", index.uid)))?;
        if documents.is_empty() {
            return Ok(offset);
        }
        let page_count = documents.len();
        client
            .request_task(
                Method::POST,
                &format!("/indexes/{}/documents", index.temporary_uid),
                &documents,
            )
            .await?;
        offset += page_count;
        if page_count < 1000 {
            return Ok(offset);
        }
    }
}

/// 将重建任务标记完成。
async fn finish_rebuild(
    state: &SharedState,
    task_id: ObjectId,
    index_count: usize,
) -> AppResult<()> {
    task_collection(state)
        .update_one(
            task_id_filter(task_id),
            doc! { "$set": {
                "status": "succeeded",
                "phase": "completed",
                "progress": 100,
                "updatedAt": DateTime::now(),
                "finishedAt": DateTime::now(),
            }, "$push": { "logs": format!("全部 {index_count} 个 Meilisearch 索引重建完成") } },
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use bson::oid::ObjectId;
    use serde_json::json;

    use crate::error::AppResult;

    use super::build_rebuild_indexes;

    /// 验证重建会包含任意正式索引并排除历史临时索引。
    #[test]
    fn builds_targets_for_all_formal_indexes() -> AppResult<()> {
        let task_id = ObjectId::from_bytes([1; 12]);
        let indexes = vec![
            json!({ "uid": "posts", "primaryKey": "id" }),
            json!({ "uid": "products", "primaryKey": "sku" }),
            json!({
                "uid": "notes__rebuild_507f1f77bcf86cd799439012",
                "primaryKey": "id"
            }),
        ];

        let targets = build_rebuild_indexes(&indexes, task_id)?;

        assert_eq!(targets.len(), 2);
        assert!(targets.iter().any(|target| target.uid == "posts"));
        assert!(targets.iter().any(|target| target.uid == "products"));
        assert!(
            targets
                .iter()
                .all(|target| target.temporary_uid.ends_with(&task_id.to_hex()))
        );
        Ok(())
    }
}
