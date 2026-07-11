//! Configuration management

pub mod database;
pub mod runtime;

use std::env;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct AppConfig {
    /// JWT secret key for token signing
    pub jwt_secret: String,
    /// GitHub OAuth client ID
    pub github_client_id: String,
    /// GitHub OAuth client secret
    pub github_client_secret: String,
    /// QQ OAuth app ID
    pub qq_app_id: String,
    /// QQ OAuth app key
    pub qq_app_key: String,
    /// Frontend URL for redirects
    pub frontend_url: String,
    /// Backend URL for OAuth callbacks
    pub backend_url: String,
    /// Cloudflare Turnstile secret
    pub turnstile_secret: String,
    /// MongoDB connection URI
    pub mongodb_uri: String,
    /// MongoDB connection timeout in seconds
    pub mongodb_timeout_secs: u64,
    /// MongoDB max pool size
    pub mongodb_max_pool_size: u32,
    /// Meilisearch host URL
    pub meilisearch_host: String,
    /// Meilisearch API key
    pub meilisearch_api_key: String,
    /// Friend link health check interval in hours
    pub link_health_interval_hours: u64,
    /// Friend link request timeout in seconds
    pub link_health_timeout_secs: u64,
    /// Whether visitors may submit friend link applications
    pub friend_link_allow_apply: bool,
    /// Whether friend links may point to URL sub-paths
    pub friend_link_allow_sub_path: bool,
    /// Whether all comments are disabled
    pub comments_disabled: bool,
    /// Whether comments without Chinese characters are allowed
    pub comments_allow_no_chinese: bool,
    /// Whether non-owner comments require moderation
    pub comments_require_audit: bool,
    /// Whether IP geolocation is recorded
    pub comments_record_ip_location: bool,
    /// Blocked comment IP addresses
    pub comments_blocked_ips: Vec<String>,
    /// Keywords that immediately classify a comment as spam
    pub comments_spam_keywords: Vec<String>,
    /// Whether to expose the embedded admin dashboard
    pub admin_dashboard_enabled: bool,
}

/// Configuration error types
#[derive(Debug)]
pub enum ConfigError {
    MissingEnvVar(String),
    InvalidConfig(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::MissingEnvVar(var) => write!(f, "Missing environment variable: {}", var),
            ConfigError::InvalidConfig(msg) => write!(f, "Invalid configuration: {}", msg),
        }
    }
}

impl std::error::Error for ConfigError {}

impl AppConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| ConfigError::MissingEnvVar("JWT_SECRET".to_string()))?;

        if jwt_secret.is_empty() {
            return Err(ConfigError::InvalidConfig(
                "JWT_SECRET cannot be empty".to_string(),
            ));
        }

        if jwt_secret.len() < 32 {
            return Err(ConfigError::InvalidConfig(
                "JWT_SECRET must be at least 32 characters long for security".to_string(),
            ));
        }

        let mongodb_uri = env::var("MONGODB_URI")
            .unwrap_or_else(|_| "mongodb://localhost:27017/mx-space".to_string());

        let mongodb_timeout_secs = env::var("MONGODB_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let mongodb_max_pool_size = env::var("MONGODB_MAX_POOL_SIZE")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(10);

        Ok(Self {
            jwt_secret,
            github_client_id: env::var("GITHUB_CLIENT_ID").unwrap_or_default(),
            github_client_secret: env::var("GITHUB_CLIENT_SECRET").unwrap_or_default(),
            qq_app_id: env::var("QQ_APP_ID").unwrap_or_default(),
            qq_app_key: env::var("QQ_APP_KEY").unwrap_or_default(),
            frontend_url: env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),
            backend_url: env::var("BACKEND_URL")
                .unwrap_or_else(|_| "http://localhost:8000".to_string()),
            turnstile_secret: env::var("TURNSTILE_SECRET")
                .unwrap_or_else(|_| "THISISTURNSTILEKEY".to_string()),
            mongodb_uri,
            mongodb_timeout_secs,
            mongodb_max_pool_size,
            meilisearch_host: env::var("MEILISEARCH_URL")
                .or_else(|_| env::var("MEILISEARCH_HOST"))
                .unwrap_or_else(|_| "http://localhost:7700".to_string()),
            meilisearch_api_key: env::var("MEILISEARCH_API_KEY").unwrap_or_default(),
            link_health_interval_hours: env::var("LINK_HEALTH_CHECK_INTERVAL_HOURS")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(6),
            link_health_timeout_secs: env::var("LINK_HEALTH_TIMEOUT")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(10),
            friend_link_allow_apply: false,
            friend_link_allow_sub_path: false,
            comments_disabled: false,
            comments_allow_no_chinese: true,
            comments_require_audit: true,
            comments_record_ip_location: true,
            comments_blocked_ips: Vec::new(),
            comments_spam_keywords: Vec::new(),
            admin_dashboard_enabled: env::var("ADMIN_DASHBOARD_ENABLED")
                .ok()
                .map(|v| {
                    matches!(
                        v.trim().to_ascii_lowercase().as_str(),
                        "1" | "true" | "yes" | "on"
                    )
                })
                .unwrap_or(true),
        })
    }
}
