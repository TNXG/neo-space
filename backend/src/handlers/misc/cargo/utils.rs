pub fn build_crate_cache_key(name: &str, version: Option<&str>) -> String {
    let version_part = version
        .map(|value| format!("{}@{value}", name.to_lowercase()))
        .unwrap_or_else(|| format!("{}@latest", name.to_lowercase()));

    format!("cargo_crate_{version_part}")
}

pub fn is_valid_crate_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}

pub fn base_version(requirement: &str) -> String {
    let raw_version = requirement
        .trim()
        .trim_start_matches(|character: char| "^~>=<! ".contains(character))
        .split(',')
        .next()
        .unwrap_or("")
        .trim();

    if raw_version.is_empty() {
        return "0.0.0".to_string();
    }

    let mut parts = raw_version
        .split('.')
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    while parts.len() < 3 {
        parts.push("0".to_string());
    }

    parts.join(".")
}

pub fn normalize_dep_kind(kind: Option<&str>) -> String {
    match kind.unwrap_or("normal") {
        "dev" => "dev".to_string(),
        "build" => "build".to_string(),
        _ => "normal".to_string(),
    }
}
