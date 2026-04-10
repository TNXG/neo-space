//! Link health check background task - scheduling and orchestration

use crate::app::SharedState;
use bson::doc;
use futures::stream::TryStreamExt;
use mongodb::Collection;
use std::time::Duration;
use tokio::time::interval;

pub use super::link_health_check::LinkHealthStatus;
use super::link_health_check::perform_health_check;

fn elapsed_millis_u64(start: std::time::Instant) -> u64 {
    u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX)
}

/// Start the periodic link health check task
pub fn start_link_health_task(state: SharedState) {
    let check_interval_hours = std::env::var("LINK_HEALTH_CHECK_INTERVAL_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(6);

    tokio::spawn(async move {
        let mut timer = interval(Duration::from_secs(check_interval_hours * 3600));

        // 立即执行第一次检查（跳过第一个 tick）
        timer.tick().await;
        tracing::info!("开始友链健康检查...");

        match check_all_links(&state).await {
            Ok(result) => {
                tracing::info!(
                    "[LinkHealth] 批量检查完成 - 总数: {}, 存活: {}, 失败: {}, 耗时: {}ms",
                    result.total,
                    result.alive_count,
                    result.failed_count,
                    result.duration_ms
                );
            }
            Err(e) => {
                tracing::error!("友链健康检查失败: {}", e);
            }
        }

        loop {
            timer.tick().await;
            tracing::info!("开始友链健康检查...");

            match check_all_links(&state).await {
                Ok(result) => {
                    tracing::info!(
                        "[LinkHealth] 批量检查完成 - 总数: {}, 存活: {}, 失败: {}, 耗时: {}ms",
                        result.total,
                        result.alive_count,
                        result.failed_count,
                        result.duration_ms
                    );
                }
                Err(e) => {
                    tracing::error!("友链健康检查失败: {}", e);
                }
            }
        }
    });
}

/// Check all links in the database
async fn check_all_links(state: &SharedState) -> Result<LinkHealthCheckResult, String> {
    let start = std::time::Instant::now();
    let collection: Collection<serde_json::Value> = state.db.collection("links");

    // Only check active links
    let filter = doc! {
        "$or": [
            { "state": 0 },  // LinkState::NORMAL
            { "state": { "$exists": false } }
        ]
    };

    let mut cursor = collection
        .find(filter)
        .await
        .map_err(|e| format!("Failed to query links: {}", e))?;

    let mut links = Vec::new();
    while let Some(link) = cursor
        .try_next()
        .await
        .map_err(|e| format!("Failed to iterate links: {}", e))?
    {
        links.push(link);
    }

    let total = links.len();
    tracing::info!("[LinkHealth] 开始批量检查 {} 个友链", total);

    // Check links concurrently with a limit
    let results = check_links_concurrent(links, state).await;

    // Store results in cache for API responses
    for result in &results {
        let cache_key = format!("link_health_{}", result.link_id);
        // Serialize HostingProvider enum to lowercase string via serde_json
        let hosting_provider_str = serde_json::to_value(&result.hosting_provider)
            .ok()
            .and_then(|v| v.as_str().map(ToString::to_string))
            .unwrap_or_else(|| "unknown".to_string());
        let health_data = crate::models::LinkHealthStatus {
            link_id: result.link_id.clone(),
            url: result.url.clone(),
            is_alive: result.is_alive,
            status_code: result.status_code,
            latency_ms: result.latency_ms,
            hosting_provider: hosting_provider_str,
            checked_at: result.checked_at.to_rfc3339(),
            error_message: result.error_message.clone(),
            is_stale: false,
        };
        if let Ok(serialized) = serde_json::to_vec(&health_data) {
            state.cache.insert(cache_key, serialized).await;
        }
    }

    let alive_count = results.iter().filter(|r| r.is_alive).count();
    let failed_count = total - alive_count;
    let duration_ms = elapsed_millis_u64(start);

    Ok(LinkHealthCheckResult {
        total,
        alive_count,
        failed_count,
        duration_ms,
    })
}

/// Check multiple links concurrently
async fn check_links_concurrent(
    links: Vec<serde_json::Value>,
    state: &SharedState,
) -> Vec<LinkHealthStatus> {
    use futures::stream::{self, StreamExt};

    let concurrency_limit = (links.len() / 2).clamp(3, 17);
    tracing::info!("[LinkHealth] 使用并发数: {}", concurrency_limit);

    stream::iter(links)
        .map(|link| {
            let http_client = state.http_client.clone();
            async move { perform_health_check(&link, &http_client).await }
        })
        .buffer_unordered(concurrency_limit)
        .collect()
        .await
}

/// Link health check result
#[derive(Debug, Clone)]
struct LinkHealthCheckResult {
    total: usize,
    alive_count: usize,
    failed_count: usize,
    duration_ms: u64,
}
