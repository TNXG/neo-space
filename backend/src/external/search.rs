//! Search service (Meilisearch)

use meilisearch_sdk::{client::Client, indexes::Index, search::Selectors};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::AppError;

/// Post document for Meilisearch
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostDocument {
    pub id: String,
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

    /// Initialize Meilisearch indexes with proper settings
    pub async fn init_indexes(&self) -> Result<(), AppError> {
        tracing::info!("开始初始化 Meilisearch 索引...");

        // Health check with retry
        for attempt in 1..=5 {
            match self.client.health().await {
                Ok(_) => {
                    tracing::info!("Meilisearch 健康检查通过");
                    break;
                }
                Err(e) => {
                    if attempt == 5 {
                        return Err(AppError::Internal(format!(
                            "Meilisearch 健康检查失败（重试 5 次）: {}",
                            e
                        )));
                    }
                    tracing::warn!("Meilisearch 健康检查失败（第 {} 次），等待重试...", attempt);
                    tokio::time::sleep(std::time::Duration::from_secs(3 * attempt as u64)).await;
                }
            }
        }

        // Create posts index
        match self.client.create_index("posts", Some("id")).await {
            Ok(task) => {
                tracing::info!("文章索引创建任务已提交: task_uid={}", task.task_uid);
            }
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("index_already_exists") {
                    tracing::debug!("文章索引已存在，跳过创建");
                } else {
                    tracing::warn!("创建文章索引失败: {}", e);
                }
            }
        }

        // Configure posts index
        let posts_index = self.posts_index();
        posts_index
            .set_searchable_attributes(&["title", "text", "category", "tags"])
            .await
            .map_err(|e| AppError::Internal(format!("设置文章 searchable 属性失败: {}", e)))?;
        posts_index
            .set_filterable_attributes(&["category", "tags", "created"])
            .await
            .map_err(|e| AppError::Internal(format!("设置文章 filterable 属性失败: {}", e)))?;
        posts_index
            .set_sortable_attributes(&["created"])
            .await
            .map_err(|e| AppError::Internal(format!("设置文章 sortable 属性失败: {}", e)))?;
        tracing::info!("文章索引配置完成");

        // Create notes index
        match self.client.create_index("notes", Some("id")).await {
            Ok(task) => {
                tracing::info!("笔记索引创建任务已提交: task_uid={}", task.task_uid);
            }
            Err(e) => {
                let err_str = e.to_string();
                if err_str.contains("index_already_exists") {
                    tracing::debug!("笔记索引已存在，跳过创建");
                } else {
                    tracing::warn!("创建笔记索引失败: {}", e);
                }
            }
        }

        // Configure notes index
        let notes_index = self.notes_index();
        notes_index
            .set_searchable_attributes(&["title", "text"])
            .await
            .map_err(|e| AppError::Internal(format!("设置笔记 searchable 属性失败: {}", e)))?;
        notes_index
            .set_filterable_attributes(&["created"])
            .await
            .map_err(|e| AppError::Internal(format!("设置笔记 filterable 属性失败: {}", e)))?;
        notes_index
            .set_sortable_attributes(&["created"])
            .await
            .map_err(|e| AppError::Internal(format!("设置笔记 sortable 属性失败: {}", e)))?;
        tracing::info!("笔记索引配置完成");

        tracing::info!("Meilisearch 索引初始化完成");
        Ok(())
    }

    /// Bulk index post documents
    pub async fn index_posts(&self, docs: Vec<PostDocument>) -> Result<(), AppError> {
        if docs.is_empty() {
            tracing::debug!("没有文章需要索引");
            return Ok(());
        }
        let index = self.posts_index();
        index
            .add_documents(&docs, Some("id"))
            .await
            .map_err(|e| AppError::Internal(format!("批量索引文章失败: {}", e)))?;
        tracing::info!("已提交 {} 篇文章到 Meilisearch", docs.len());
        Ok(())
    }

    /// Bulk index note documents
    pub async fn index_notes(&self, docs: Vec<NoteDocument>) -> Result<(), AppError> {
        if docs.is_empty() {
            tracing::debug!("没有笔记需要索引");
            return Ok(());
        }
        let index = self.notes_index();
        index
            .add_documents(&docs, Some("id"))
            .await
            .map_err(|e| AppError::Internal(format!("批量索引笔记失败: {}", e)))?;
        tracing::info!("已提交 {} 篇笔记到 Meilisearch", docs.len());
        Ok(())
    }

    /// Search posts with highlighting
    pub async fn search_posts(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<PostSearchHit>, AppError> {
        let index = self.posts_index();
        let mut search = index.search();
        search
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
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
    ) -> Result<Vec<NoteSearchHit>, AppError> {
        let index = self.notes_index();
        let mut search = index.search();
        search
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
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
