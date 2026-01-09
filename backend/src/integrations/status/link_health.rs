//! 友链健康检查服务
//!
//! 功能：
//! - 检查网站存活状态
//! - 测量响应延迟
//! - 检测部署服务商（Vercel、Cloudflare、Netlify 等）
//! - Stale-While-Revalidate (SWR) 缓存策略

use futures::stream::TryStreamExt;
use moka::future::Cache;
use mongodb::bson::doc;
use mongodb::Database;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use utoipa::ToSchema;

use crate::integrations::status::hosting::{HostingDetector, HostingProvider};
use crate::models::{Link, LinkState};

/// 友链健康状态
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(example = json!({
    "link_id": "507f1f77bcf86cd799439011",
    "url": "https://example.com",
    "is_alive": true,
    "status_code": 200,
    "latency_ms": 150,
    "hosting_provider": "vercel",
    "checked_at": "2025-01-01T00:00:00Z",
    "error_message": null,
    "is_stale": false
}))]
pub struct LinkHealthStatus {
    /// 友链 ID
    pub link_id: String,
    /// 友链 URL
    pub url: String,
    /// 是否存活
    pub is_alive: bool,
    /// HTTP 状态码
    pub status_code: Option<u16>,
    /// 响应延迟（毫秒）
    pub latency_ms: Option<u64>,
    /// 部署服务商
    pub hosting_provider: HostingProvider,
    /// 检查时间
    pub checked_at: chrono::DateTime<chrono::Utc>,
    /// 错误信息
    pub error_message: Option<String>,
    /// 是否为过期数据（正在后台刷新）
    pub is_stale: bool,
}

/// 友链健康状态（带缓存元数据）
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CachedHealthStatus {
    /// 健康状态数据
    pub status: LinkHealthStatus,
    /// 缓存时间
    pub cached_at: chrono::DateTime<chrono::Utc>,
}

impl CachedHealthStatus {
    /// 检查是否过期（6小时）
    fn is_expired(&self, stale_time_hours: u64) -> bool {
        let now = chrono::Utc::now();
        let stale_duration = chrono::Duration::hours(stale_time_hours as i64);
        now.signed_duration_since(self.cached_at) > stale_duration
    }

    /// 创建新的缓存条目
    fn new(mut status: LinkHealthStatus) -> Self {
        status.is_stale = false;
        Self {
            status,
            cached_at: chrono::Utc::now(),
        }
    }

    /// 转换为过期状态返回
    fn to_stale_status(&self) -> LinkHealthStatus {
        let mut status = self.status.clone();
        status.is_stale = true;
        status
    }
}

/// 批量健康检查结果
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BatchHealthCheckResult {
    /// 检查总数
    pub total: usize,
    /// 存活数量
    pub alive_count: usize,
    /// 失败数量
    pub failed_count: usize,
    /// 各友链健康状态
    pub results: Vec<LinkHealthStatus>,
    /// 检查耗时（毫秒）
    pub duration_ms: u64,
}

/// 友链健康检查服务 (SWR 策略)
#[derive(Clone)]
pub struct LinkHealthService {
    /// HTTP 客户端
    client: Client,
    /// 健康状态缓存 (`link_id` -> `CachedHealthStatus`)
    cache: Arc<Cache<String, CachedHealthStatus>>,
    /// 正在刷新的友链 ID 集合（防止重复刷新）
    refreshing: Arc<Mutex<HashSet<String>>>,
    /// 缓存过期时间（小时）
    stale_time_hours: u64,
    /// Revalidation 服务（可选）
    revalidation_service: Option<Arc<crate::infrastructure::RevalidationService>>,
}

impl LinkHealthService {
    /// 创建新的健康检查服务
    ///
    /// # 参数
    /// - `stale_time_hours`: 缓存过期时间（小时），默认 6
    /// - `timeout_seconds`: 请求超时时间（秒），默认 10
    ///
    /// # Panics
    /// 如果 HTTP 客户端创建失败，将会 panic
    pub fn new(stale_time_hours: u64, timeout_seconds: u64) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_seconds))
            .user_agent("Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0; +mailto:tnxg@outlook.jp; ) AppleWebKit/99 (KHTML, like Gecko) Chrome/99 MyGO/5 (KiraKira/DokiDoki; Bananice/Protected) Giraffe/4.11 (Wakarimasu/; Haruhikage/Stop)")
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .expect("Failed to create HTTP client");

        // 缓存永不过期，由我们手动管理过期逻辑
        let cache = Cache::builder().max_capacity(1000).build();

        log::info!(
            "友链健康检查服务初始化 - 过期时间: {stale_time_hours}小时, 超时: {timeout_seconds}秒"
        );

        Self {
            client,
            cache: Arc::new(cache),
            refreshing: Arc::new(Mutex::new(HashSet::new())),
            stale_time_hours,
            revalidation_service: None,
        }
    }

    /// 设置 Revalidation 服务（用于通知 Next.js 刷新缓存）
    pub fn with_revalidation_service(
        mut self,
        service: Arc<crate::infrastructure::RevalidationService>,
    ) -> Self {
        self.revalidation_service = Some(service);
        self
    }

    /// 检查单个友链的健康状态 (SWR 策略)
    ///
    /// 逻辑：
    /// 1. 如果缓存存在且未过期，直接返回缓存
    /// 2. 如果缓存存在但已过期，返回过期数据并异步刷新
    /// 3. 如果缓存不存在，同步检查并返回结果
    pub async fn check_link(&self, link: &Link) -> LinkHealthStatus {
        let link_id = link.id.to_hex();

        // 检查缓存
        if let Some(cached) = self.cache.get(&link_id).await {
            if cached.is_expired(self.stale_time_hours) {
                // 缓存已过期，返回过期数据并异步刷新
                log::debug!("[LinkHealth] 缓存命中（过期）: {}", link.url);

                // 检查是否已在刷新中
                {
                    let mut refreshing = self.refreshing.lock().await;
                    if !refreshing.contains(&link_id) {
                        refreshing.insert(link_id.clone());

                        // 异步刷新
                        let service = self.clone();
                        let link_clone = link.clone();
                        tokio::spawn(async move {
                            log::info!("[LinkHealth] 异步刷新开始: {}", link_clone.url);
                            let new_status = service.perform_health_check(&link_clone).await;
                            let cached_status = CachedHealthStatus::new(new_status);
                            service
                                .cache
                                .insert(link_clone.id.to_hex(), cached_status)
                                .await;

                            // 移除刷新标记
                            service
                                .refreshing
                                .lock()
                                .await
                                .remove(&link_clone.id.to_hex());
                            log::info!("[LinkHealth] 异步刷新完成: {}", link_clone.url);
                        });
                    }
                }

                // 返回过期数据（标记为 stale）
                return cached.to_stale_status();
            }
            // 缓存未过期，直接返回
            log::debug!("[LinkHealth] 缓存命中（新鲜）: {}", link.url);
            return cached.status;
        }

        // 缓存不存在，同步检查
        log::info!("[LinkHealth] 缓存未命中，同步检查: {}", link.url);
        let status = self.perform_health_check(link).await;
        let cached_status = CachedHealthStatus::new(status.clone());
        self.cache.insert(link_id, cached_status).await;

        status
    }

    /// 执行实际的健康检查
    async fn perform_health_check(&self, link: &Link) -> LinkHealthStatus {
        let start = Instant::now();
        let link_id = link.id.to_hex();
        let url = &link.url;

        log::debug!("[LinkHealth] 检查: {url}");

        match self.client.get(url).send().await {
            Ok(response) => {
                let latency = start.elapsed().as_millis() as u64;
                let status_code = response.status().as_u16();
                let is_alive = response.status().is_success() || response.status().is_redirection();

                // 检测部署服务商
                let hosting_provider = HostingDetector::detect(&response);

                log::info!(
                    "[LinkHealth] {url} - 状态: {status_code}, 延迟: {latency}ms, 服务商: {hosting_provider:?}"
                );

                LinkHealthStatus {
                    link_id,
                    url: url.clone(),
                    is_alive,
                    status_code: Some(status_code),
                    latency_ms: Some(latency),
                    hosting_provider,
                    checked_at: chrono::Utc::now(),
                    error_message: None,
                    is_stale: false,
                }
            }
            Err(e) => {
                let latency = start.elapsed().as_millis() as u64;
                let error_msg = if e.is_timeout() {
                    "请求超时".to_string()
                } else if e.is_connect() {
                    "连接失败".to_string()
                } else {
                    format!("请求失败: {e}")
                };

                log::warn!("[LinkHealth] {url} - 失败: {error_msg}");

                LinkHealthStatus {
                    link_id,
                    url: url.clone(),
                    is_alive: false,
                    status_code: None,
                    latency_ms: Some(latency),
                    hosting_provider: HostingProvider::Unknown,
                    checked_at: chrono::Utc::now(),
                    error_message: Some(error_msg),
                    is_stale: false,
                }
            }
        }
    }

    /// 批量检查所有友链（强制刷新）
    pub async fn check_all_links(&self, db: &Database) -> BatchHealthCheckResult {
        let start = Instant::now();
        let collection = db.collection::<Link>("links");

        // 只检查正常状态的友链
        let filter = doc! {
            "$or": [
                { "state": LinkState::NORMAL },
                { "state": { "$exists": false } }
            ]
        };

        let mut cursor = match collection.find(filter).await {
            Ok(c) => c,
            Err(e) => {
                log::error!("[LinkHealth] 查询友链失败: {e:?}");
                return BatchHealthCheckResult {
                    total: 0,
                    alive_count: 0,
                    failed_count: 0,
                    results: vec![],
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
        };

        let mut links = Vec::new();
        while let Ok(Some(link)) = cursor.try_next().await {
            links.push(link);
        }

        let total = links.len();
        log::info!("[LinkHealth] 开始批量检查 {total} 个友链");

        // 并发检查所有友链（限制并发数）
        let results = self.check_links_concurrent(links).await;

        let alive_count = results.iter().filter(|r| r.is_alive).count();
        let failed_count = total - alive_count;
        let duration_ms = start.elapsed().as_millis() as u64;

        log::info!(
            "[LinkHealth] 批量检查完成 - 总数: {total}, 存活: {alive_count}, 失败: {failed_count}, 耗时: {duration_ms}ms"
        );

        // 通知 Next.js 刷新友链页面缓存（同时刷新 tag 和 ISR 页面）
        if let Some(ref revalidation_service) = self.revalidation_service {
            log::info!("[LinkHealth] 通知 Next.js 刷新友链缓存...");
            if let Err(e) = revalidation_service
                .revalidate_both("links", "/friends")
                .await
            {
                log::error!("[LinkHealth] 刷新友链缓存失败: {e:?}");
            } else {
                log::info!("[LinkHealth] ✓ 友链缓存已刷新（tag + ISR 页面）");
            }
        }

        BatchHealthCheckResult {
            total,
            alive_count,
            failed_count,
            results,
            duration_ms,
        }
    }

    /// 并发检查多个友链（限制并发数为 20）
    async fn check_links_concurrent(&self, links: Vec<Link>) -> Vec<LinkHealthStatus> {
        use futures::stream::{self, StreamExt};

        // 根据友链数量动态调整并发数
        let concurrency_limit = std::cmp::min(20, std::cmp::max(5, links.len() / 2));

        log::info!("[LinkHealth] 使用并发数: {concurrency_limit}");

        stream::iter(links)
            .map(|link| {
                let service = self.clone();
                async move {
                    let status = service.perform_health_check(&link).await;
                    // 更新缓存
                    let cached_status = CachedHealthStatus::new(status.clone());
                    service.cache.insert(link.id.to_hex(), cached_status).await;
                    status
                }
            })
            .buffer_unordered(concurrency_limit)
            .collect()
            .await
    }

    /// 启动定期健康检查任务（每 N 小时检查一次）
    ///
    /// # 参数
    /// - `db`: 数据库连接
    /// - `interval_hours`: 检查间隔（小时）
    pub fn start_periodic_check(self, db: Database, interval_hours: u64) {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(interval_hours * 3600));
            interval.tick().await; // 跳过第一次立即触发

            loop {
                interval.tick().await;
                log::info!("[LinkHealth] 开始定期健康检查...");

                let result = self.check_all_links(&db).await;
                log::info!(
                    "[LinkHealth] 定期检查完成 - 总数: {}, 存活: {}, 失败: {}, 耗时: {}ms",
                    result.total,
                    result.alive_count,
                    result.failed_count,
                    result.duration_ms
                );
            }
        });
    }

    /// 批量检查友链列表（用于 API 响应）
    ///
    /// 使用 SWR 策略：优先返回缓存，过期则异步刷新
    pub async fn check_links_batch(&self, links: Vec<Link>) -> Vec<LinkWithHealth> {
        use futures::stream::{self, StreamExt};

        // 动态调整并发数
        let concurrency_limit = std::cmp::min(20, std::cmp::max(5, links.len() / 2));

        stream::iter(links)
            .map(|link| {
                let service = self.clone();
                async move {
                    let health_status = service.check_link(&link).await;
                    LinkWithHealth {
                        link,
                        health: Some(health_status),
                    }
                }
            })
            .buffer_unordered(concurrency_limit)
            .collect()
            .await
    }
}

/// 友链及其健康状态（用于服务层）
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, utoipa::ToSchema)]
pub struct LinkWithHealth {
    #[serde(flatten)]
    pub link: Link,
    pub health: Option<LinkHealthStatus>,
}
