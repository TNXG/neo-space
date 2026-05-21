use std::time::Duration;

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
};

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

    Ok(entries)
}

pub async fn fetch_crate_size(state: &SharedState, name: &str, version: &str) -> Option<u64> {
    let shared_cache_key = format!("{SIZE_CACHE_PREFIX}{}@{version}", name.to_lowercase());

    if let Some(cached) = state.cache.get(&shared_cache_key).await {
        let size = serde_json::from_slice::<Option<u64>>(&cached).ok()?;
        return size;
    }

    let url = format!("{STATIC_BASE}/{name}/{name}-{version}.crate");
    let response = state
        .http_client
        .head(url)
        .timeout(Duration::from_secs(SIZE_TIMEOUT_SECS))
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    let size = response
        .headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());

    if let Ok(serialized) = serde_json::to_vec(&size) {
        state.cache.insert(shared_cache_key, serialized).await;
    }

    size
}
