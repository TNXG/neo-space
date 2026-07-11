//! Link (Friend) model

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::serializers::{deserialize_id_to_string, serialize_datetime};

/// Link state constants
/// - 0: Normal
/// - 1: Pending
pub struct LinkState;

impl LinkState {
    pub const NORMAL: i32 = 0;
    pub const PENDING: i32 = 1;
}

/// Link type constants
/// - 0: Friend (default)
pub struct LinkType;

impl LinkType {
    pub const FRIEND: i32 = 0;
}

/// Link (Friend) model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Link {
    #[serde(rename = "_id", deserialize_with = "deserialize_id_to_string")]
    #[schema(value_type = String)]
    pub id: String,
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub avatar: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub state: i32,
    #[serde(default)]
    pub r#type: i32,
    #[serde(
        serialize_with = "serialize_datetime",
        deserialize_with = "crate::models::serializers::deserialize_flexible_datetime"
    )]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    pub email: Option<String>,
    pub rssurl: Option<String>,
    pub techstack: Option<Vec<String>>,
}

/// Link apply request
#[derive(Debug, Deserialize, ToSchema)]
pub struct LinkApplyRequest {
    pub name: String,
    pub url: String,
    pub avatar: String,
    pub description: String,
    pub email: String,
    pub code: String,
    pub rssurl: Option<String>,
    pub techstack: Option<Vec<String>>,
}

/// Send verification code request
#[derive(Debug, Deserialize, ToSchema)]
pub struct SendCodeRequest {
    pub email: String,
}

/// Link with health status (for API responses)
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct LinkWithHealth {
    #[serde(flatten)]
    pub link: Link,
    pub health: Option<LinkHealthStatus>,
}

/// Link health status
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct LinkHealthStatus {
    /// Link ID
    pub link_id: String,
    /// Link URL
    pub url: String,
    /// Is alive
    pub is_alive: bool,
    /// HTTP status code
    pub status_code: Option<u16>,
    /// Latency in milliseconds
    pub latency_ms: Option<u64>,
    /// Hosting provider (lowercase string, e.g. "cloudflare", "vercel")
    #[serde(default)]
    pub hosting_provider: String,
    /// Checked at
    pub checked_at: String,
    /// Error message
    pub error_message: Option<String>,
    /// Is stale data (being refreshed in background)
    pub is_stale: bool,
}
