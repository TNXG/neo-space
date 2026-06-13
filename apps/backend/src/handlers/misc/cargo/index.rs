use std::time::Duration;

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
};

use super::cache;
use super::types::{
    INDEX_BASE, INDEX_CACHE_PREFIX, INDEX_TIMEOUT_SECS, IndexCache, IndexEntry, SIZE_CACHE_PREFIX,
    SIZE_TIMEOUT_SECS, STATIC_BASE,
};

pub fn resolve_version(entries: &[IndexEntry], version: Option<&str>) -> Option<IndexEntry> {
    if let Some(version) = version
        && let Some(entry) = entries
            .iter()
            .find(|entry| entry.vers == version && !entry.yanked)
    {
        return Some(entry.clone());
    }

    entries.iter().rev().find(|entry| !entry.yanked).cloned()
}

pub fn index_path(name: &str) -> String {
    let lower = name.to_lowercase();
    let mut characters = lower.chars();

    match lower.chars().count() {
        0 => String::new(),
        1 => format!("1/{lower}"),
        2 => format!("2/{lower}"),
        3 => {
            let Some(first_character) = characters.next() else {
                return String::new();
            };
            format!("3/{first_character}/{lower}")
        }
        _ => {
            let prefix = characters.by_ref().take(2).collect::<String>();
            let middle = characters.take(2).collect::<String>();
            format!("{prefix}/{middle}/{lower}")
        }
    }
}

pub async fn fetch_index_entries(
    state: &SharedState,
    index_cache: &IndexCache,
    name: &str,
) -> AppResult<Vec<IndexEntry>> {
    let cache_key = name.to_lowercase();
    let shared_cache_key = format!("{INDEX_CACHE_PREFIX}{cache_key}");

    {
        let cache = index_cache.lock().await;
        if let Some(entries) = cache.get(&cache_key) {
            return Ok(entries.clone());
        }
    }

    if let Some(cached) = state.cache.get(&shared_cache_key).await {
        let entries: Vec<IndexEntry> = serde_json::from_slice(&cached).map_err(|error| {
            AppError::Internal(format!("Failed to decode cargo index cache: {error}"))
        })?;

        let mut cache = index_cache.lock().await;
        cache.insert(cache_key.clone(), entries.clone());
        return Ok(entries);
    }

    if let Some(entries) = cache::read_index_entries(name).await? {
        let mut cache = index_cache.lock().await;
        cache.insert(cache_key.clone(), entries.clone());

        if let Ok(serialized) = serde_json::to_vec(&entries) {
            state.cache.insert(shared_cache_key, serialized).await;
        }

        return Ok(entries);
    }

    let url = format!("{INDEX_BASE}/{}", index_path(name));
    let response = state
        .http_client
        .get(url)
        .timeout(Duration::from_secs(INDEX_TIMEOUT_SECS))
        .header("accept", "application/json")
        .send()
        .await
        .map_err(|error| AppError::Internal(format!("Failed to fetch crate index: {error}")))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(Vec::new());
    }

    let response = response
        .error_for_status()
        .map_err(|error| AppError::Internal(format!("Crate index request failed: {error}")))?;

    let text = response
        .text()
        .await
        .map_err(|error| AppError::Internal(format!("Failed to read crate index: {error}")))?;

    let entries = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(serde_json::from_str::<IndexEntry>)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::Internal(format!("Failed to parse crate index: {error}")))?;

    let mut cache = index_cache.lock().await;
    cache.insert(cache_key, entries.clone());

    if let Ok(serialized) = serde_json::to_vec(&entries) {
        state.cache.insert(shared_cache_key, serialized).await;
    }
    cache::write_index_entries(name, &entries).await;

    Ok(entries)
}

pub async fn fetch_cached_crate_size(
    state: &SharedState,
    name: &str,
    version: &str,
) -> Option<Option<u64>> {
    let shared_cache_key = format!("{SIZE_CACHE_PREFIX}{}@{version}", name.to_lowercase());

    if let Some(cached) = state.cache.get(&shared_cache_key).await {
        let size = serde_json::from_slice::<Option<u64>>(&cached).ok()?;
        if size.is_some() {
            return Some(size);
        }

        state.cache.invalidate(&shared_cache_key).await;
    }

    match cache::read_crate_size(name, version).await {
        Ok(Some(size)) => {
            if size.is_some() {
                if let Ok(serialized) = serde_json::to_vec(&size) {
                    state.cache.insert(shared_cache_key, serialized).await;
                }
                return Some(size);
            }
        }
        Ok(None) => {}
        Err(error) => {
            tracing::warn!(
                crate = %name,
                version = %version,
                "Failed to read cargo size disk cache: {error:?}",
            );
        }
    }

    None
}

pub async fn fetch_crate_size(state: &SharedState, name: &str, version: &str) -> Option<u64> {
    if let Some(cached_size) = fetch_cached_crate_size(state, name, version).await {
        return cached_size;
    }

    let shared_cache_key = format!("{SIZE_CACHE_PREFIX}{}@{version}", name.to_lowercase());
    let url = format!("{STATIC_BASE}/{name}/{name}-{version}.crate");
    let head_response = state
        .http_client
        .head(&url)
        .timeout(Duration::from_secs(SIZE_TIMEOUT_SECS))
        .send()
        .await
        .ok()?;

    if !head_response.status().is_success() {
        return None;
    }

    let size = match parse_content_length(head_response.headers()) {
        Some(size) => Some(size),
        None => fetch_crate_size_from_get(state, &url).await,
    };

    let size = size?;

    if let Ok(serialized) = serde_json::to_vec(&Some(size)) {
        state.cache.insert(shared_cache_key, serialized).await;
    }
    cache::write_crate_size(name, version, &Some(size)).await;

    Some(size)
}

async fn fetch_crate_size_from_get(state: &SharedState, url: &str) -> Option<u64> {
    let response = state
        .http_client
        .get(url)
        .header(reqwest::header::RANGE, "bytes=0-0")
        .timeout(Duration::from_secs(SIZE_TIMEOUT_SECS))
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    parse_content_length(response.headers())
}

fn parse_content_length(headers: &reqwest::header::HeaderMap) -> Option<u64> {
    headers
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
}
