//! Application settings and configuration

use std::env;

/// OAuth configuration structure
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub jwt_secret: String,
    pub github_client_id: String,
    pub github_client_secret: String,
    pub frontend_url: String,
    pub backend_url: String,
}

impl OAuthConfig {
    /// Load OAuth configuration from environment variables (fallback)
    pub fn from_env() -> Result<Self, ConfigError> {
        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| ConfigError::MissingEnvVar("JWT_SECRET".to_string()))?;
        
        if jwt_secret.is_empty() {
            return Err(ConfigError::InvalidConfig("JWT_SECRET cannot be empty".to_string()));
        }

        let github_client_id = env::var("GITHUB_CLIENT_ID")
            .unwrap_or_default();
        
        let github_client_secret = env::var("GITHUB_CLIENT_SECRET")
            .unwrap_or_default();
        
        let frontend_url = env::var("FRONTEND_URL")
            .unwrap_or_else(|_| "http://localhost:3000".to_string());

        let backend_url = env::var("BACKEND_URL")
            .unwrap_or_else(|_| "http://localhost:8000".to_string());

        Ok(Self {
            jwt_secret,
            github_client_id,
            github_client_secret,
            frontend_url,
            backend_url,
        })
    }

    /// Get GitHub OAuth redirect URI (points to backend)
    pub fn github_redirect_uri(&self) -> String {
        format!("{}/api/auth/oauth/github/callback", self.backend_url)
    }

    /// Get QQ OAuth redirect URI (points to backend)
    pub fn qq_redirect_uri(&self) -> String {
        format!("{}/api/auth/oauth/qq/callback", self.backend_url)
    }
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
