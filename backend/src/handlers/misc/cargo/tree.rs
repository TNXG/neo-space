use std::{collections::HashMap, sync::Arc};

use futures::stream::{self, StreamExt};

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
};

use super::{
    index::{self, fetch_crate_size},
    types::{
        CONCURRENCY, CrateDepInfo, DependencySeed, IndexCache, IndexEntry, MAX_DEPS, MAX_DEPTH,
    },
    utils,
};

pub async fn resolve_all_dependencies(
    state: &SharedState,
    index_cache: &IndexCache,
    root_entry: &IndexEntry,
) -> AppResult<Vec<CrateDepInfo>> {
    let mut discovered_dependencies = HashMap::<String, DependencySeed>::new();
    let mut pending_dependencies = Vec::<DependencySeed>::new();

    for dependency in &root_entry.deps {
        let dependency_name = dependency
            .package
            .clone()
            .unwrap_or_else(|| dependency.name.clone());

        let dependency_seed = DependencySeed {
            name: dependency_name.clone(),
            req: dependency.req.clone(),
            kind: utils::normalize_dep_kind(dependency.kind.as_deref()),
            optional: dependency.optional,
            target: dependency.target.clone(),
            features_requested: dependency.features.clone(),
            depth: 0,
            resolved_version: None,
        };

        if let std::collections::hash_map::Entry::Vacant(entry) =
            discovered_dependencies.entry(dependency_name)
        {
            entry.insert(dependency_seed.clone());
            pending_dependencies.push(dependency_seed);
        }
    }

    expand_dependency_tree(
        state,
        index_cache,
        &mut discovered_dependencies,
        &mut pending_dependencies,
    )
    .await?;
    resolve_missing_versions(state, index_cache, &mut discovered_dependencies).await?;

    let seeds = discovered_dependencies
        .values()
        .cloned()
        .collect::<Vec<_>>();
    let size_by_crate = fetch_dependency_sizes(state, &seeds).await;
    let mut dependencies = seeds
        .into_iter()
        .map(|seed| CrateDepInfo {
            name: seed.name.clone(),
            version: seed
                .resolved_version
                .clone()
                .unwrap_or_else(|| utils::base_version(&seed.req)),
            kind: seed.kind,
            optional: seed.optional,
            target: seed.target,
            features_requested: seed.features_requested,
            crate_size: size_by_crate.get(&seed.name).copied().flatten(),
            depth: seed.depth,
        })
        .collect::<Vec<_>>();

    dependencies.sort_by(|left, right| {
        right
            .crate_size
            .unwrap_or(0)
            .cmp(&left.crate_size.unwrap_or(0))
            .then_with(|| left.name.cmp(&right.name))
    });

    Ok(dependencies)
}

async fn expand_dependency_tree(
    state: &SharedState,
    index_cache: &IndexCache,
    discovered_dependencies: &mut HashMap<String, DependencySeed>,
    pending_dependencies: &mut Vec<DependencySeed>,
) -> AppResult<()> {
    let mut next_batch_index = 0;

    while next_batch_index < pending_dependencies.len() && discovered_dependencies.len() < MAX_DEPS
    {
        let Some(current_seed) = pending_dependencies.get(next_batch_index) else {
            break;
        };
        let current_depth = current_seed.depth;
        let mut depth_batch = Vec::new();

        while let Some(dependency_seed) = pending_dependencies.get(next_batch_index) {
            if dependency_seed.depth != current_depth {
                break;
            }

            depth_batch.push(dependency_seed.clone());
            next_batch_index += 1;
        }

        if current_depth >= MAX_DEPTH {
            break;
        }

        let resolvable_dependencies = depth_batch
            .into_iter()
            .filter(|dependency_seed| dependency_seed.kind != "dev" && !dependency_seed.optional)
            .collect::<Vec<_>>();

        let resolution_results = stream::iter(resolvable_dependencies)
            .map(|dependency_seed| {
                let shared_state = state.clone();
                let shared_index_cache = Arc::clone(index_cache);
                async move {
                    resolve_dependency_entry(&shared_state, &shared_index_cache, dependency_seed)
                        .await
                }
            })
            .buffer_unordered(CONCURRENCY)
            .collect::<Vec<_>>()
            .await;

        for result in resolution_results {
            let (resolved_seed, resolved_entry) = result?;

            if let Some(stored_seed) = discovered_dependencies.get_mut(&resolved_seed.name) {
                stored_seed.resolved_version =
                    resolved_entry.as_ref().map(|entry| entry.vers.clone());
            }

            let Some(entry) = resolved_entry else {
                continue;
            };

            for dependency in entry.deps {
                if discovered_dependencies.len() >= MAX_DEPS {
                    break;
                }

                let dependency_kind = utils::normalize_dep_kind(dependency.kind.as_deref());
                if dependency_kind == "dev" {
                    continue;
                }

                let dependency_name = dependency.package.unwrap_or(dependency.name);
                if discovered_dependencies.contains_key(&dependency_name) {
                    continue;
                }

                let dependency_seed = DependencySeed {
                    name: dependency_name.clone(),
                    req: dependency.req,
                    kind: dependency_kind,
                    optional: dependency.optional,
                    target: dependency.target,
                    features_requested: dependency.features,
                    depth: current_depth + 1,
                    resolved_version: None,
                };

                discovered_dependencies.insert(dependency_name, dependency_seed.clone());
                pending_dependencies.push(dependency_seed);
            }
        }
    }

    Ok(())
}

async fn resolve_missing_versions(
    state: &SharedState,
    index_cache: &IndexCache,
    discovered_dependencies: &mut HashMap<String, DependencySeed>,
) -> AppResult<()> {
    let unresolved_dependencies = discovered_dependencies
        .values()
        .filter(|dependency_seed| dependency_seed.resolved_version.is_none())
        .cloned()
        .collect::<Vec<_>>();

    if unresolved_dependencies.is_empty() {
        return Ok(());
    }

    let resolution_results = stream::iter(unresolved_dependencies)
        .map(|dependency_seed| {
            let shared_state = state.clone();
            let shared_index_cache = Arc::clone(index_cache);
            async move {
                let (_, resolved_entry) = resolve_dependency_entry(
                    &shared_state,
                    &shared_index_cache,
                    dependency_seed.clone(),
                )
                .await?;
                Ok::<_, AppError>((dependency_seed, resolved_entry.map(|entry| entry.vers)))
            }
        })
        .buffer_unordered(CONCURRENCY)
        .collect::<Vec<_>>()
        .await;

    for result in resolution_results {
        let (resolved_seed, resolved_version) = result?;
        if let Some(stored_seed) = discovered_dependencies.get_mut(&resolved_seed.name) {
            stored_seed.resolved_version =
                resolved_version.or_else(|| Some(utils::base_version(&resolved_seed.req)));
        }
    }

    Ok(())
}

async fn resolve_dependency_entry(
    state: &SharedState,
    index_cache: &IndexCache,
    dependency_seed: DependencySeed,
) -> AppResult<(DependencySeed, Option<IndexEntry>)> {
    let entries = match index::fetch_index_entries(state, index_cache, &dependency_seed.name).await
    {
        Ok(entries) => entries,
        Err(error) => {
            tracing::warn!(
                crate = %dependency_seed.name,
                depth = dependency_seed.depth,
                "Failed to fetch dependency index during resolution: {error:?}",
            );
            return Ok((dependency_seed, None));
        }
    };

    let resolved_entry = index::resolve_version(
        &entries,
        Some(utils::base_version(&dependency_seed.req).as_str()),
    )
    .or_else(|| index::resolve_version(&entries, None));

    Ok((dependency_seed, resolved_entry))
}

async fn fetch_dependency_sizes(
    state: &SharedState,
    seeds: &[DependencySeed],
) -> HashMap<String, Option<u64>> {
    stream::iter(seeds.iter().cloned())
        .map(|dependency_seed| {
            let shared_state = state.clone();
            async move {
                let version = dependency_seed
                    .resolved_version
                    .clone()
                    .unwrap_or_else(|| utils::base_version(&dependency_seed.req));
                let size = fetch_crate_size(&shared_state, &dependency_seed.name, &version).await;
                (dependency_seed.name, size)
            }
        })
        .buffer_unordered(CONCURRENCY)
        .collect::<Vec<_>>()
        .await
        .into_iter()
        .collect()
}
