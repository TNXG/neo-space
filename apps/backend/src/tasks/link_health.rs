//! Link health check background task - scheduling and orchestration

use crate::app::SharedState;
use crate::models::{Link, LinkFeedSummary, LinkHealthStatus, LinkState};
use bson::doc;
use futures::stream::{self, StreamExt, TryStreamExt};
use std::time::Duration;

use super::link_health_check::{fetch_feed_summary, perform_health_check};

fn elapsed_millis_u64(start: std::time::Instant) -> u64 {
    u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX)
}

pub fn health_cache_key(link_id: &str) -> String {
    format!("link_health_{link_id}")
}

/// 读取单个友链的健康状态缓存
pub async fn cached_health(state: &SharedState, link_id: &str) -> Option<LinkHealthStatus> {
    state
        .link_health_cache
        .get(&health_cache_key(link_id))
        .await
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
}

/// 读取单个友链的订阅源缓存
pub async fn cached_feed(state: &SharedState, link_id: &str) -> Option<LinkFeedSummary> {
    state.link_feed_cache.get(link_id).await
}

/// Start the periodic link health check task.
///
/// 首轮检查在后台立即执行，不阻塞 HTTP 服务启动；期间接口按「未检查」降级返回。
pub fn start_link_health_task(state: SharedState) {
    let mut config_events = state.config_events.subscribe();

    tokio::spawn(async move {
        run_link_health_check(&state).await;
        loop {
            let check_interval_hours = state.config().link_health_interval_hours.max(1);
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(check_interval_hours * 3600)) => {
                    run_link_health_check(&state).await;
                }
                event = config_events.recv() => {
                    match event {
                        Ok(()) | Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                            tracing::info!("友链健康检查周期已按最新配置重新调度");
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => return,
                    }
                }
            }
        }
    });
}

/// Run one full link health check and populate the health / feed caches.
pub async fn run_link_health_check(state: &SharedState) {
    tracing::info!("开始友链健康检查...");
    let start = std::time::Instant::now();

    match load_active_links(state).await {
        Ok(links) => {
            let total = links.len();
            let results = check_links(state, links).await;
            let alive = results.iter().filter(|(health, _)| health.is_alive).count();
            let feeds_ok = results
                .iter()
                .filter(|(_, feed)| feed.as_ref().is_some_and(|f| f.error_message.is_none()))
                .count();
            tracing::info!(
                "[LinkHealth] 批量检查完成 - 总数: {}, 存活: {}, 订阅可用: {}, 耗时: {}ms",
                total,
                alive,
                feeds_ok,
                elapsed_millis_u64(start)
            );
            // 公共友链页按 links 标签缓存；检查结果落地后通知其重新生成
            crate::tasks::isr::trigger_isr_revalidation(state, "links", None).await;
        }
        Err(error) => tracing::error!("友链健康检查失败: {}", error),
    }
}

/// 查询全部已通过的友链
pub async fn load_active_links(state: &SharedState) -> Result<Vec<Link>, String> {
    let filter = doc! {
        "$or": [
            { "state": LinkState::NORMAL },
            { "state": { "$exists": false } }
        ]
    };
    state
        .db
        .collection::<Link>("links")
        .find(filter)
        .await
        .map_err(|e| format!("Failed to query links: {e}"))?
        .try_collect()
        .await
        .map_err(|e| format!("Failed to iterate links: {e}"))
}

/// 并发检查站点与订阅源，并写入缓存
pub async fn check_links(
    state: &SharedState,
    links: Vec<Link>,
) -> Vec<(LinkHealthStatus, Option<LinkFeedSummary>)> {
    let concurrency_limit = (links.len() / 2).clamp(3, 17);
    stream::iter(links)
        .map(|link| async move { check_link(state, &link).await })
        .buffer_unordered(concurrency_limit)
        .collect()
        .await
}

/// 检查单个友链：站点与订阅源并行请求，结果写入各自缓存
pub async fn check_link(
    state: &SharedState,
    link: &Link,
) -> (LinkHealthStatus, Option<LinkFeedSummary>) {
    let timeout_secs = state.config().link_health_timeout_secs;
    let feed_url = link
        .rssurl
        .as_deref()
        .map(str::trim)
        .filter(|url| !url.is_empty());

    let health_future = perform_health_check(&link.id, &link.url, &state.http_client, timeout_secs);
    let feed_future = async {
        match feed_url {
            Some(url) => Some(fetch_feed_summary(&link.id, url, &state.http_client, timeout_secs).await),
            None => None,
        }
    };
    let (result, feed) = tokio::join!(health_future, feed_future);

    let hosting_provider = serde_json::to_value(&result.hosting_provider)
        .ok()
        .and_then(|v| v.as_str().map(ToString::to_string))
        .unwrap_or_else(|| "unknown".to_string());
    let health = LinkHealthStatus {
        link_id: result.link_id,
        url: result.url,
        is_alive: result.is_alive,
        status_code: result.status_code,
        latency_ms: result.latency_ms,
        hosting_provider,
        checked_at: result.checked_at.to_rfc3339(),
        error_message: result.error_message,
        is_stale: false,
    };
    if let Ok(serialized) = serde_json::to_vec(&health) {
        state
            .link_health_cache
            .insert(health_cache_key(&link.id), serialized)
            .await;
    }
    match &feed {
        Some(summary) => {
            state
                .link_feed_cache
                .insert(link.id.clone(), summary.clone())
                .await;
        }
        None => state.link_feed_cache.invalidate(&link.id).await,
    }
    (health, feed)
}
