//! Application settings and configuration

use serde::Deserialize;

/// MongoDB configuration structure
#[derive(Deserialize, Debug, Clone)]
pub struct MongoConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
}

impl Default for MongoConfig {
    fn default() -> Self {
        Self {
            host: "localhost".to_string(),
            port: 27017,
            database: "mx-space".to_string(),
        }
    }
}
