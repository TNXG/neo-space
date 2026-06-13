use std::path::PathBuf;

use serde::{Deserialize, Serialize, de::DeserializeOwned};

use crate::{
    error::{AppError, AppResult},
    handlers::misc::cargo::types::{CrateInfo, IndexEntry},
};

const CARGO_CACHE_ROOT: &str = ".cache/cargo";

pub async fn read_crate_info(name: &str, version: Option<&str>) -> AppResult<Option<CrateInfo>> {
    read_json(crate_info_path(name, version)).await
}

pub async fn write_crate_info(name: &str, version: Option<&str>, data: &CrateInfo) {
    write_json(crate_info_path(name, version), data).await;
}

pub async fn read_index_entries(name: &str) -> AppResult<Option<Vec<IndexEntry>>> {
    read_json(index_entries_path(name)).await
}

pub async fn write_index_entries(name: &str, entries: &[IndexEntry]) {
    write_json(index_entries_path(name), entries).await;
}

pub async fn read_crate_size(name: &str, version: &str) -> AppResult<Option<Option<u64>>> {
    let path = crate_size_path(name, version);
    let Some(value) = read_json::<serde_json::Value>(path).await? else {
        return Ok(None);
    };

    if value.is_null() {
        return Ok(Some(None));
    }

    if let Some(size) = value.as_u64() {
        return Ok(Some(Some(size)));
    }

    let entry = serde_json::from_value::<CrateSizeCacheEntry>(value).map_err(|error| {
        AppError::Internal(format!("Failed to decode cargo size disk cache: {error}"))
    })?;
    Ok(Some(entry.size))
}

pub async fn write_crate_size(name: &str, version: &str, size: &Option<u64>) {
    write_json(
        crate_size_path(name, version),
        &CrateSizeCacheEntry { size: *size },
    )
    .await;
}

async fn read_json<T>(path: PathBuf) -> AppResult<Option<T>>
where
    T: DeserializeOwned,
{
    match tokio::fs::read(&path).await {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|error| {
            AppError::Internal(format!(
                "Failed to decode cargo disk cache {}: {error}",
                path.display()
            ))
        }),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(AppError::Internal(format!(
            "Failed to read cargo disk cache {}: {error}",
            path.display()
        ))),
    }
}

async fn write_json<T>(path: PathBuf, data: &T)
where
    T: Serialize + ?Sized,
{
    let Some(parent) = path.parent() else {
        return;
    };

    if let Err(error) = tokio::fs::create_dir_all(parent).await {
        tracing::warn!(
            path = %parent.display(),
            "Failed to create cargo disk cache directory: {error:?}",
        );
        return;
    }

    let serialized = match serde_json::to_vec_pretty(data) {
        Ok(serialized) => serialized,
        Err(error) => {
            tracing::warn!(
                path = %path.display(),
                "Failed to encode cargo disk cache: {error:?}",
            );
            return;
        }
    };

    if let Err(error) = tokio::fs::write(&path, serialized).await {
        tracing::warn!(
            path = %path.display(),
            "Failed to write cargo disk cache: {error:?}",
        );
    }
}

fn crate_info_path(name: &str, version: Option<&str>) -> PathBuf {
    PathBuf::from(CARGO_CACHE_ROOT)
        .join("crates")
        .join(cache_segment(name))
        .join(format!(
            "{}.json",
            cache_segment(version.unwrap_or("latest"))
        ))
}

fn index_entries_path(name: &str) -> PathBuf {
    PathBuf::from(CARGO_CACHE_ROOT)
        .join("index")
        .join(format!("{}.json", cache_segment(name)))
}

fn crate_size_path(name: &str, version: &str) -> PathBuf {
    PathBuf::from(CARGO_CACHE_ROOT)
        .join("sizes")
        .join(cache_segment(name))
        .join(format!("{}.json", cache_segment(version)))
}

fn cache_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect()
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct CrateSizeCacheEntry {
    size: Option<u64>,
}
