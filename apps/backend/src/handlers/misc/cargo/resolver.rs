use std::{collections::HashMap, sync::Arc};

use tokio::sync::Mutex;

use crate::{app::SharedState, error::AppResult};

use super::{
    index::{self, resolve_version},
    tree::resolve_all_dependencies,
    types::CrateInfo,
};

pub async fn resolve_crate(
    state: &SharedState,
    name: &str,
    version: Option<&str>,
) -> AppResult<Option<CrateInfo>> {
    let index_cache = Arc::new(Mutex::new(HashMap::new()));

    let entries = index::fetch_index_entries(state, &index_cache, name).await?;
    if entries.is_empty() {
        return Ok(None);
    }

    let Some(root_entry) = resolve_version(&entries, version) else {
        return Ok(None);
    };

    let dependencies = resolve_all_dependencies(state, &index_cache, &root_entry).await?;
    let total_dep_size = dependencies
        .iter()
        .map(|dependency| dependency.crate_size.unwrap_or(0))
        .sum();

    Ok(Some(CrateInfo {
        name: root_entry.name,
        version: root_entry.vers,
        rust_version: root_entry.rust_version,
        features: root_entry.features,
        deps: dependencies,
        total_dep_size,
    }))
}
