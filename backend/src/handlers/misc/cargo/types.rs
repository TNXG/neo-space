use std::{collections::HashMap, sync::Arc};

use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

pub const INDEX_BASE: &str = "https://index.crates.io";
pub const STATIC_BASE: &str = "https://static.crates.io/crates";
pub const INDEX_TIMEOUT_SECS: u64 = 8;
pub const SIZE_TIMEOUT_SECS: u64 = 5;
pub const MAX_DEPTH: usize = 3;
pub const MAX_DEPS: usize = 200;
pub const CONCURRENCY: usize = 10;
pub const INDEX_CACHE_PREFIX: &str = "cargo_index_";
pub const SIZE_CACHE_PREFIX: &str = "cargo_size_";

pub type IndexCache = Arc<Mutex<HashMap<String, Vec<IndexEntry>>>>;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IndexDependency {
    pub name: String,
    pub req: String,
    pub kind: Option<String>,
    pub optional: bool,
    pub target: Option<String>,
    pub features: Vec<String>,
    pub package: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct IndexEntry {
    pub name: String,
    pub vers: String,
    pub deps: Vec<IndexDependency>,
    pub features: HashMap<String, Vec<String>>,
    pub yanked: bool,
    pub rust_version: Option<String>,
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
pub struct DependencySeed {
    pub name: String,
    pub req: String,
    pub kind: String,
    pub optional: bool,
    pub target: Option<String>,
    pub features_requested: Vec<String>,
    pub depth: usize,
    pub resolved_version: Option<String>,
}
