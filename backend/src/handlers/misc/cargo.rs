//! Cargo crate dependency analysis handlers

use std::{collections::HashMap, sync::Arc, time::Duration};

use axum::{
    Json,
    extract::{Path, State},
};
use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::ApiResponse,
};

const CACHE_MAX_AGE_SECS: u64 = 60 * 60 * 24;
const INDEX_BASE: &str = "https://index.crates.io";
const STATIC_BASE: &str = "https://static.crates.io/crates";
const INDEX_TIMEOUT_SECS: u64 = 8;
const SIZE_TIMEOUT_SECS: u64 = 5;
const MAX_DEPTH: usize = 3;
const MAX_DEPS: usize = 200;
const CONCURRENCY: usize = 10;

type IndexCache = Arc<Mutex<HashMap<String, Vec<IndexEntry>>>>;

#[derive(Debug, Clone, Deserialize)]
struct IndexDependency {
    name: String,
    req: String,
    kind: Option<String>,
    optional: bool,
    target: Option<String>,
    features: Vec<String>,
    package: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct IndexEntry {
    name: String,
    vers: String,
    deps: Vec<IndexDependency>,
    features: HashMap<String, Vec<String>>,
    yanked: bool,
    rust_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CrateDepInfo {
    pub name: String,
    pub version: String,
    pub kind: String,
    pub optional: bool,
    pub target: Option<String>,
    pub features_requested: Vec<String>,
    pub crate_size: Option<u64>,
    pub depth: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct CrateInfo {
    pub name: String,
    pub version: String,
    pub rust_version: Option<String>,
    pub features: HashMap<String, Vec<String>>,
    pub deps: Vec<CrateDepInfo>,
    pub total_dep_size: u64,
}

#[derive(Debug, Clone)]
struct DepSeed {
    name: String,
    req: String,
    kind: String,
    optional: bool,
    target: Option<String>,
    features_requested: Vec<String>,
    depth: usize,
    resolved_version: Option<String>,
}

pub async fn get_crate_info(
    State(state): State<SharedState>,
    Path(name): Path<String>,
) -> AppResult<Json<ApiResponse<CrateInfo>>> {
    get_crate_info_inner(state, name, None).await
}

pub async fn get_crate_info_with_version(
    State(state): State<SharedState>,
    Path((name, version)): Path<(String, String)>,
) -> AppResult<Json<ApiResponse<CrateInfo>>> {
    get_crate_info_inner(state, name, Some(version)).await
}

async fn get_crate_info_inner(
    state: SharedState,
    name: String,
    version: Option<String>,
) -> AppResult<Json<ApiResponse<CrateInfo>>> {
    if !is_valid_crate_name(&name) {
        return Err(AppError::BadRequest("Invalid crate name".to_string()));
    }

    let cache_key = format!(
        "cargo_crate_{}",
        version
            .as_ref()
            .map(|value| format!("{}@{}", name.to_lowercase(), value))
            .unwrap_or_else(|| format!("{}@latest", name.to_lowercase()))
    );

    if let Some(cached) = state.cache.get(&cache_key).await {
        let data: CrateInfo = serde_json::from_slice(&cached)
            .map_err(|error| AppError::Internal(format!("Failed to decode cargo cache: {error}")))?;

        return Ok(Json(ApiResponse::success(data)));
    }

    let data = resolve_crate(&state, &name, version.as_deref())
        .await?
        .ok_or_else(|| AppError::NotFound("Crate or version not found".to_string()))?;

    if let Ok(serialized) = serde_json::to_vec(&data) {
        state.cache.insert(cache_key, serialized).await;
    }

    Ok(Json(ApiResponse::success(data)))
}

async fn resolve_crate(
    state: &SharedState,
    name: &str,
    version: Option<&str>,
) -> AppResult<Option<CrateInfo>> {
    let index_cache = Arc::new(Mutex::new(HashMap::new()));

    let entries = fetch_index_entries(state, &index_cache, name).await?;
    if entries.is_empty() {
        return Ok(None);
    }

    let Some(root_entry) = resolve_version(&entries, version) else {
        return Ok(None);
    };

    let deps = resolve_all_dependencies(state, &index_cache, &root_entry).await?;
    let total_dep_size = deps.iter().map(|dep| dep.crate_size.unwrap_or(0)).sum();

    Ok(Some(CrateInfo {
        name: root_entry.name,
        version: root_entry.vers,
        rust_version: root_entry.rust_version,
        features: root_entry.features,
        deps,
        total_dep_size,
    }))
}

async fn resolve_all_dependencies(
    state: &SharedState,
    index_cache: &IndexCache,
    root_entry: &IndexEntry,
) -> AppResult<Vec<CrateDepInfo>> {
    let mut seen = HashMap::<String, DepSeed>::new();
    let mut queue = Vec::<DepSeed>::new();

    for dependency in &root_entry.deps {
        let name = dependency
            .package
            .clone()
            .unwrap_or_else(|| dependency.name.clone());

        let seed = DepSeed {
            name: name.clone(),
            req: dependency.req.clone(),
            kind: normalize_dep_kind(dependency.kind.as_deref()),
            optional: dependency.optional,
            target: dependency.target.clone(),
            features_requested: dependency.features.clone(),
            depth: 0,
            resolved_version: None,
        };

        if !seen.contains_key(&name) {
            seen.insert(name, seed.clone());
            queue.push(seed);
        }
    }

    let mut head = 0;
    while head < queue.len() && seen.len() < MAX_DEPS {
        let current_depth = queue[head].depth;
        let mut batch = Vec::new();

        while head < queue.len() && queue[head].depth == current_depth {
            batch.push(queue[head].clone());
            head += 1;
        }

        if current_depth >= MAX_DEPTH {
            break;
        }

        let resolvable = batch
            .iter()
            .filter(|seed| seed.kind != "dev" && !seed.optional)
            .cloned()
            .collect::<Vec<_>>();

        let results = stream::iter(resolvable)
            .map(|seed| {
                let state = state.clone();
                let index_cache = Arc::clone(index_cache);
                async move {
                    let entries = fetch_index_entries(&state, &index_cache, &seed.name).await?;
                    let entry = resolve_version(&entries, Some(base_version(&seed.req).as_str()))
                        .or_else(|| resolve_version(&entries, None));
                    Ok::<_, AppError>((seed, entry))
                }
            })
            .buffer_unordered(CONCURRENCY)
            .collect::<Vec<_>>()
            .await;

        for result in results {
            let (seed, entry) = result?;

            if let Some(stored_seed) = seen.get_mut(&seed.name) {
                stored_seed.resolved_version = entry.as_ref().map(|value| value.vers.clone());
            }

            let Some(entry) = entry else {
                continue;
            };

            for dependency in entry.deps {
                if seen.len() >= MAX_DEPS {
                    break;
                }

                let kind = normalize_dep_kind(dependency.kind.as_deref());
                if kind == "dev" {
                    continue;
                }

                let name = dependency.package.unwrap_or(dependency.name);
                if seen.contains_key(&name) {
                    continue;
                }

                let child_seed = DepSeed {
                    name: name.clone(),
                    req: dependency.req,
                    kind,
                    optional: dependency.optional,
                    target: dependency.target,
                    features_requested: dependency.features,
                    depth: current_depth + 1,
                    resolved_version: None,
                };

                seen.insert(name, child_seed.clone());
                queue.push(child_seed);
            }
        }
    }

    let unresolved = seen
        .values()
        .filter(|seed| seed.resolved_version.is_none())
        .cloned()
        .collect::<Vec<_>>();

    if !unresolved.is_empty() {
        let results = stream::iter(unresolved)
            .map(|seed| {
                let state = state.clone();
                let index_cache = Arc::clone(index_cache);
                async move {
                    let entries = fetch_index_entries(&state, &index_cache, &seed.name).await?;
                    let entry = resolve_version(&entries, Some(base_version(&seed.req).as_str()))
                        .or_else(|| resolve_version(&entries, None));
                    Ok::<_, AppError>((seed, entry.map(|value| value.vers)))
                }
            })
            .buffer_unordered(CONCURRENCY)
            .collect::<Vec<_>>()
            .await;

        for result in results {
            let (seed, version) = result?;
            if let Some(stored_seed) = seen.get_mut(&seed.name) {
                stored_seed.resolved_version = version.or_else(|| Some(base_version(&seed.req)));
            }
        }
    }

    let seeds = seen.values().cloned().collect::<Vec<_>>();

    let size_results = stream::iter(seeds.iter().cloned())
        .map(|seed| {
            let state = state.clone();
            async move {
                let version = seed
                    .resolved_version
                    .clone()
                    .unwrap_or_else(|| base_version(&seed.req));
                let size = fetch_crate_size(&state, &seed.name, &version).await;
                (seed.name, size)
            }
        })
        .buffer_unordered(CONCURRENCY)
        .collect::<Vec<_>>()
        .await;

    let size_map = size_results.into_iter().collect::<HashMap<_, _>>();

    let mut deps = seeds
        .into_iter()
        .map(|seed| CrateDepInfo {
            name: seed.name.clone(),
            version: seed
                .resolved_version
                .clone()
                .unwrap_or_else(|| base_version(&seed.req)),
            kind: seed.kind,
            optional: seed.optional,
            target: seed.target,
            features_requested: seed.features_requested,
            crate_size: size_map.get(&seed.name).copied().flatten(),
            depth: seed.depth,
        })
        .collect::<Vec<_>>();

    deps.sort_by(|left, right| {
        right
            .crate_size
            .unwrap_or(0)
            .cmp(&left.crate_size.unwrap_or(0))
            .then_with(|| left.name.cmp(&right.name))
    });

    Ok(deps)
}

async fn fetch_index_entries(
    state: &SharedState,
    index_cache: &IndexCache,
    name: &str,
) -> AppResult<Vec<IndexEntry>> {
    let cache_key = name.to_lowercase();

    {
        let cache = index_cache.lock().await;
        if let Some(entries) = cache.get(&cache_key) {
            return Ok(entries.clone());
        }
    }

    let url = format!("{}/{}", INDEX_BASE, index_path(name));
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
        .map(|line| serde_json::from_str::<IndexEntry>(line))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| AppError::Internal(format!("Failed to parse crate index: {error}")))?;

    let mut cache = index_cache.lock().await;
    cache.insert(cache_key, entries.clone());

    Ok(entries)
}

async fn fetch_crate_size(state: &SharedState, name: &str, version: &str) -> Option<u64> {
    let url = format!("{STATIC_BASE}/{name}/{name}-{version}.crate");

    let response = state
        .http_client
        .get(url)
        .timeout(Duration::from_secs(SIZE_TIMEOUT_SECS))
        .send()
        .await
        .ok()?;

    if !response.status().is_success() {
        return None;
    }

    response
        .headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
}

fn resolve_version(entries: &[IndexEntry], version: Option<&str>) -> Option<IndexEntry> {
    if let Some(version) = version {
        if let Some(entry) = entries.iter().find(|entry| entry.vers == version && !entry.yanked) {
            return Some(entry.clone());
        }
    }

    entries.iter().rev().find(|entry| !entry.yanked).cloned()
}

fn index_path(name: &str) -> String {
    let lower = name.to_lowercase();
    match lower.len() {
        0 => String::new(),
        1 => format!("1/{lower}"),
        2 => format!("2/{lower}"),
        3 => format!("3/{}/{lower}", &lower[0..1]),
        _ => format!("{}/{}/{}", &lower[0..2], &lower[2..4], lower),
    }
}

fn base_version(requirement: &str) -> String {
    let raw = requirement
        .trim()
        .trim_start_matches(|char: char| "^~>=<! ".contains(char))
        .split(',')
        .next()
        .unwrap_or_default()
        .trim();

    let mut parts = raw.split('.').map(ToString::to_string).collect::<Vec<_>>();
    while parts.len() < 3 {
        parts.push("0".to_string());
    }

    parts.join(".")
}

fn normalize_dep_kind(kind: Option<&str>) -> String {
    match kind.unwrap_or("normal") {
        "dev" => "dev".to_string(),
        "build" => "build".to_string(),
        _ => "normal".to_string(),
    }
}

fn is_valid_crate_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || matches!(char, '-' | '_'))
}

#[allow(dead_code)]
fn _cache_control_header() -> String {
    format!("public, max-age={CACHE_MAX_AGE_SECS}")
}
