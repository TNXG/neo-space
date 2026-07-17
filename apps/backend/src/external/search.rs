//! Search service (Meilisearch)

use meilisearch_sdk::{
    client::Client, documents::DocumentDeletionQuery, indexes::Index, search::Selectors,
    task_info::TaskInfo,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use crate::error::AppError;

/// Post document for Meilisearch
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostDocument {
    pub id: String,
    pub ref_id: String,
    pub lang: String,
    pub title: String,
    pub text: String,
    pub slug: String,
    pub category: Option<String>,
    pub category_name: Option<String>,
    pub tags: Vec<String>,
    pub created: i64,
}

/// Note document for Meilisearch
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteDocument {
    pub id: String,
    pub ref_id: String,
    pub lang: String,
    pub title: String,
    pub text: String,
    pub nid: i32,
    pub created: i64,
}

/// Post search hit with highlighting
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostSearchHit {
    pub doc: PostDocument,
    pub formatted: HashMap<String, String>,
    pub score: f64,
}

/// Note search hit with highlighting
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteSearchHit {
    pub doc: NoteDocument,
    pub formatted: HashMap<String, String>,
    pub score: f64,
}

/// Extract formatted strings from Meilisearch response
fn extract_formatted_strings(
    map: Option<serde_json::Map<String, Value>>,
) -> HashMap<String, String> {
    let mut result = HashMap::new();
    if let Some(m) = map {
        for (k, v) in m {
            if let Value::String(s) = v {
                result.insert(k, s);
            }
        }
    }
    result
}

/// Search service wrapper for Meilisearch
#[derive(Clone)]
pub struct SearchService {
    client: Arc<Client>,
}

impl SearchService {
    /// Create a new search service
    pub fn new(url: String, api_key: Option<String>) -> Result<Self, AppError> {
        tracing::info!("Initializing Meilisearch client: {}", url);

        let client = match api_key {
            Some(key) => Client::new(url, Some(key)).map_err(|e| {
                AppError::Internal(format!("Failed to create Meilisearch client: {}", e))
            })?,
            None => Client::new(url, Option::<String>::None).map_err(|e| {
                AppError::Internal(format!("Failed to create Meilisearch client: {}", e))
            })?,
        };

        Ok(Self {
            client: Arc::new(client),
        })
    }

    /// Get posts index
    fn posts_index(&self) -> Index {
        self.client.index("posts")
    }

    /// Get notes index
    fn notes_index(&self) -> Index {
        self.client.index("notes")
    }

    /// 等待异步任务真正成功，避免把“已入队”误判为“已完成”。
    async fn wait_for_task(&self, task: TaskInfo, operation: &str) -> Result<(), AppError> {
        let task_uid = task.task_uid;
        let completed_task = task
            .wait_for_completion(
                &self.client,
                Some(Duration::from_millis(100)),
                Some(Duration::from_secs(60)),
            )
            .await
            .map_err(|error| {
                AppError::Internal(format!(
                    "Meilisearch {operation}任务等待失败（task_uid={task_uid}）: {error}"
                ))
            })?;

        if completed_task.is_failure() {
            let failure = completed_task.unwrap_failure();
            return Err(AppError::Internal(format!(
                "Meilisearch {operation}任务执行失败（task_uid={task_uid}）: {failure}"
            )));
        }

        if !completed_task.is_success() {
            return Err(AppError::Internal(format!(
                "Meilisearch {operation}任务状态异常（task_uid={task_uid}）"
            )));
        }

        Ok(())
    }

    /// Bulk index post documents
    pub async fn index_posts(&self, docs: Vec<PostDocument>) -> Result<(), AppError> {
        if docs.is_empty() {
            tracing::debug!("没有文章需要索引");
            return Ok(());
        }
        let index = self.posts_index();
        let task = index
            .add_documents(&docs, Some("id"))
            .await
            .map_err(|e| AppError::Internal(format!("批量索引文章失败: {}", e)))?;
        self.wait_for_task(task, "批量索引文章").await?;
        tracing::info!("已成功索引 {} 篇文章到 Meilisearch", docs.len());
        Ok(())
    }

    /// Bulk index note documents
    pub async fn index_notes(&self, docs: Vec<NoteDocument>) -> Result<(), AppError> {
        if docs.is_empty() {
            tracing::debug!("没有笔记需要索引");
            return Ok(());
        }
        let index = self.notes_index();
        let task = index
            .add_documents(&docs, Some("id"))
            .await
            .map_err(|e| AppError::Internal(format!("批量索引笔记失败: {}", e)))?;
        self.wait_for_task(task, "批量索引笔记").await?;
        tracing::info!("已成功索引 {} 篇笔记到 Meilisearch", docs.len());
        Ok(())
    }

    /// 删除指定文章的所有语言文档，并等待删除完成。
    pub async fn delete_post_documents_by_ref(&self, ref_id: &str) -> Result<(), AppError> {
        self.delete_documents_by_ref(self.posts_index(), ref_id, "删除文章旧索引")
            .await
    }

    /// 删除指定笔记的所有语言文档，并等待删除完成。
    pub async fn delete_note_documents_by_ref(&self, ref_id: &str) -> Result<(), AppError> {
        self.delete_documents_by_ref(self.notes_index(), ref_id, "删除笔记旧索引")
            .await
    }

    /// 按内容主键删除索引中的全部本地化文档。
    async fn delete_documents_by_ref(
        &self,
        index: Index,
        ref_id: &str,
        operation: &str,
    ) -> Result<(), AppError> {
        let filter = format!("ref_id = \"{}\"", ref_id.replace('"', "\\\""));
        let mut query = DocumentDeletionQuery::new(&index);
        query.with_filter(&filter);
        let task = index
            .delete_documents_with(&query)
            .await
            .map_err(|error| AppError::Internal(format!("{operation}失败: {error}")))?;
        self.wait_for_task(task, operation).await
    }

    /// Search posts with highlighting
    pub async fn search_posts(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
        lang: &str,
    ) -> Result<Vec<PostSearchHit>, AppError> {
        let index = self.posts_index();
        let mut search = index.search();
        let language_filter = format!("lang = \"{}\"", lang.replace('"', "\\\""));
        search
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
            .with_filter(&language_filter)
            .with_attributes_to_highlight(Selectors::Some(&["title", "text"]))
            .with_attributes_to_crop(Selectors::Some(&[("text", Some(80))]))
            .with_highlight_pre_tag("<mark>")
            .with_highlight_post_tag("</mark>")
            .with_show_ranking_score(true);

        let results = search
            .execute::<PostDocument>()
            .await
            .map_err(|e| AppError::Internal(format!("Search posts failed: {}", e)))?;

        Ok(results
            .hits
            .into_iter()
            .map(|hit| PostSearchHit {
                formatted: extract_formatted_strings(hit.formatted_result),
                score: hit.ranking_score.unwrap_or(0.0),
                doc: hit.result,
            })
            .collect())
    }

    /// Search notes with highlighting
    pub async fn search_notes(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
        lang: &str,
    ) -> Result<Vec<NoteSearchHit>, AppError> {
        let index = self.notes_index();
        let mut search = index.search();
        let language_filter = format!("lang = \"{}\"", lang.replace('"', "\\\""));
        search
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
            .with_filter(&language_filter)
            .with_attributes_to_highlight(Selectors::Some(&["title", "text"]))
            .with_attributes_to_crop(Selectors::Some(&[("text", Some(80))]))
            .with_highlight_pre_tag("<mark>")
            .with_highlight_post_tag("</mark>")
            .with_show_ranking_score(true);

        let results = search
            .execute::<NoteDocument>()
            .await
            .map_err(|e| AppError::Internal(format!("Search notes failed: {}", e)))?;

        Ok(results
            .hits
            .into_iter()
            .map(|hit| NoteSearchHit {
                formatted: extract_formatted_strings(hit.formatted_result),
                score: hit.ranking_score.unwrap_or(0.0),
                doc: hit.result,
            })
            .collect())
    }
}

// Types are already defined above and automatically exported via pub
