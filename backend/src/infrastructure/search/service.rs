use meilisearch_sdk::{client::Client, indexes::Index, search::Selectors};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

use super::http_client::NoProxyHttpClient;

/// 搜索服务
#[derive(Clone)]
pub struct SearchService {
    client: Arc<Client<NoProxyHttpClient>>,
}

/// 文章搜索文档
#[derive(Debug, Serialize, Deserialize)]
pub struct PostDocument {
    pub id: String,
    pub title: String,
    pub text: String,
    pub slug: String,
    /// 分类 slug（URL 别名）
    pub category: Option<String>,
    /// 分类显示名称
    pub category_name: Option<String>,
    pub tags: Vec<String>,
    pub created: i64,
}

/// 笔记搜索文档
#[derive(Debug, Serialize, Deserialize)]
pub struct NoteDocument {
    pub id: String,
    pub title: String,
    pub text: String,
    pub nid: i32,
    pub created: i64,
}

/// 文章搜索命中结果（包含高亮和相关度）
#[derive(Debug, Serialize, Deserialize)]
pub struct PostSearchHit {
    pub doc: PostDocument,
    /// 高亮后的字段 (key → html string with <mark> tags)
    pub formatted: HashMap<String, String>,
    /// 相关度评分 0.0 ~ 1.0
    pub score: f64,
}

/// 笔记搜索命中结果（包含高亮和相关度）
#[derive(Debug, Serialize, Deserialize)]
pub struct NoteSearchHit {
    pub doc: NoteDocument,
    /// 高亮后的字段
    pub formatted: HashMap<String, String>,
    /// 相关度评分 0.0 ~ 1.0
    pub score: f64,
}

/// 从 `formatted_result` JSON map 中提取字符串值
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

impl SearchService {
    /// 创建新的搜索服务实例
    pub fn new(url: String, api_key: Option<String>) -> Self {
        log::info!("初始化 Meilisearch 客户端: {url}");

        if let Some(ref key) = api_key {
            log::info!("使用 API Key 认证 (Key 长度: {})", key.len());
        } else {
            log::warn!("未配置 API Key，使用无认证模式");
        }

        let http_client = match NoProxyHttpClient::new(api_key.as_deref()) {
            Ok(c) => c,
            Err(e) => {
                log::error!("创建无代理 HTTP 客户端失败: {e}");
                panic!("Failed to create no-proxy HTTP client: {e}");
            }
        };

        let client = Client::new_with_client(url, api_key, http_client);
        log::info!("Meilisearch 客户端创建成功（已禁用系统代理）");

        Self {
            client: Arc::new(client),
        }
    }

    /// 健康检查
    pub async fn health_check(&self) -> Result<(), String> {
        log::info!("执行 Meilisearch 健康检查...");
        match self.client.health().await {
            Ok(health) => {
                log::info!("Meilisearch 健康状态: {health:?}");
                Ok(())
            }
            Err(e) => {
                let err_msg = e.to_string();
                log::error!("Meilisearch 健康检查失败: {err_msg}");
                Err(err_msg)
            }
        }
    }

    /// 带重试的健康检查
    pub async fn health_check_with_retry(
        &self,
        max_retries: u32,
        initial_delay_secs: u64,
    ) -> Result<(), String> {
        for attempt in 1..=max_retries {
            match self.health_check().await {
                Ok(()) => return Ok(()),
                Err(err_msg) => {
                    log::warn!(
                        "Meilisearch 健康检查失败 (尝试 {attempt}/{max_retries}): {err_msg}"
                    );

                    // 如果是最后一次尝试，直接返回错误
                    if attempt == max_retries {
                        log::error!(
                            "Meilisearch 健康检查在 {max_retries} 次尝试后仍然失败: {err_msg}"
                        );
                        return Err(err_msg);
                    }

                    // 否则等待后重试
                    let delay = initial_delay_secs * u64::from(attempt);
                    log::warn!(
                        "{delay}秒后进行第 {} 次重试...",
                        attempt + 1
                    );
                    tokio::time::sleep(std::time::Duration::from_secs(delay)).await;
                }
            }
        }
        unreachable!()
    }

    /// 初始化索引
    pub async fn init_indexes(&self) -> Result<(), String> {
        log::info!("开始初始化 Meilisearch 索引...");

        // 带重试的健康检查（最多 5 次，初始间隔 3 秒，线性递增）
        if let Err(e) = self.health_check_with_retry(5, 3).await {
            log::error!("健康检查失败，跳过索引初始化: {e}");
            return Err(e);
        }

        // 创建文章索引（如果不存在）
        log::info!("创建文章索引...");
        match self.client.create_index("posts", Some("id")).await {
            Ok(task) => log::info!("文章索引创建任务已提交: {:?}", task.task_uid),
            Err(e) => {
                let err_msg = e.to_string();
                log::warn!("创建文章索引时出错: {err_msg}");
                // 索引已存在时忽略错误
                if err_msg.contains("index_already_exists") {
                    log::info!("文章索引已存在，跳过创建");
                } else {
                    log::error!("创建文章索引失败（非预期错误）: {err_msg}");
                    return Err(err_msg);
                }
            }
        }

        log::info!("配置文章索引属性...");
        let posts_index = self.posts_index();
        posts_index
            .set_searchable_attributes(&["title", "text", "category", "tags"])
            .await
            .map_err(|e| {
                let msg = format!("设置文章索引可搜索属性失败: {e}");
                log::error!("{msg}");
                msg
            })?;
        posts_index
            .set_filterable_attributes(&["category", "tags", "created"])
            .await
            .map_err(|e| {
                let msg = format!("设置文章索引可过滤属性失败: {e}");
                log::error!("{msg}");
                msg
            })?;
        posts_index
            .set_sortable_attributes(&["created"])
            .await
            .map_err(|e| {
                let msg = format!("设置文章索引可排序属性失败: {e}");
                log::error!("{msg}");
                msg
            })?;

        log::info!("文章索引配置成功");

        // 创建笔记索引（如果不存在）
        log::info!("创建笔记索引...");
        match self.client.create_index("notes", Some("id")).await {
            Ok(task) => log::info!("笔记索引创建任务已提交: {:?}", task.task_uid),
            Err(e) => {
                let err_msg = e.to_string();
                log::warn!("创建笔记索引时出错: {err_msg}");
                // 索引已存在时忽略错误
                if err_msg.contains("index_already_exists") {
                    log::info!("笔记索引已存在，跳过创建");
                } else {
                    log::error!("创建笔记索引失败（非预期错误）: {err_msg}");
                    return Err(err_msg);
                }
            }
        }

        log::info!("配置笔记索引属性...");
        let notes_index = self.notes_index();
        notes_index
            .set_searchable_attributes(&["title", "text"])
            .await
            .map_err(|e| {
                let msg = format!("设置笔记索引可搜索属性失败: {e}");
                log::error!("{msg}");
                msg
            })?;
        notes_index
            .set_filterable_attributes(&["created"])
            .await
            .map_err(|e| {
                let msg = format!("设置笔记索引可过滤属性失败: {e}");
                log::error!("{msg}");
                msg
            })?;
        notes_index
            .set_sortable_attributes(&["created"])
            .await
            .map_err(|e| {
                let msg = format!("设置笔记索引可排序属性失败: {e}");
                log::error!("{msg}");
                msg
            })?;

        log::info!("笔记索引配置成功");
        log::info!("所有 Meilisearch 索引初始化完成");

        Ok(())
    }

    /// 获取文章索引
    pub fn posts_index(&self) -> Index<NoProxyHttpClient> {
        self.client.index("posts")
    }

    /// 获取笔记索引
    pub fn notes_index(&self) -> Index<NoProxyHttpClient> {
        self.client.index("notes")
    }

    /// 添加或更新文章文档
    pub async fn index_post(&self, doc: PostDocument) -> Result<(), Box<dyn std::error::Error>> {
        self.posts_index().add_documents(&[doc], Some("id")).await?;
        Ok(())
    }

    /// 批量添加或更新文章文档
    pub async fn index_posts(
        &self,
        docs: Vec<PostDocument>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if docs.is_empty() {
            return Ok(());
        }
        self.posts_index().add_documents(&docs, Some("id")).await?;
        Ok(())
    }

    /// 删除文章文档
    pub async fn delete_post(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.posts_index().delete_document(id).await?;
        Ok(())
    }

    /// 添加或更新笔记文档
    pub async fn index_note(&self, doc: NoteDocument) -> Result<(), Box<dyn std::error::Error>> {
        self.notes_index().add_documents(&[doc], Some("id")).await?;
        Ok(())
    }

    /// 批量添加或更新笔记文档
    pub async fn index_notes(
        &self,
        docs: Vec<NoteDocument>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if docs.is_empty() {
            return Ok(());
        }
        self.notes_index().add_documents(&docs, Some("id")).await?;
        Ok(())
    }

    /// 删除笔记文档
    pub async fn delete_note(&self, id: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.notes_index().delete_document(id).await?;
        Ok(())
    }

    /// 搜索文章（返回高亮结果和相关度评分）
    pub async fn search_posts(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<PostSearchHit>, Box<dyn std::error::Error>> {
        let results = self
            .posts_index()
            .search()
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
            .with_attributes_to_highlight(Selectors::Some(&["title", "text"]))
            .with_attributes_to_crop(Selectors::Some(&[("text", Some(80))]))
            .with_highlight_pre_tag("<mark>")
            .with_highlight_post_tag("</mark>")
            .with_show_ranking_score(true)
            .execute::<PostDocument>()
            .await?;

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

    /// 搜索笔记（返回高亮结果和相关度评分）
    pub async fn search_notes(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<NoteSearchHit>, Box<dyn std::error::Error>> {
        let results = self
            .notes_index()
            .search()
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
            .with_attributes_to_highlight(Selectors::Some(&["title", "text"]))
            .with_attributes_to_crop(Selectors::Some(&[("text", Some(80))]))
            .with_highlight_pre_tag("<mark>")
            .with_highlight_post_tag("</mark>")
            .with_show_ranking_score(true)
            .execute::<NoteDocument>()
            .await?;

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
