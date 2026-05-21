//! User and OAuth provider models
//!
//! Reader and Account models are split into separate files:
//! - `reader.rs` — Reader, ReaderResponse
//! - `account.rs` — Account, AccountResponse

use serde::{Deserialize, Serialize};

use super::serializers::{serialize_datetime, serialize_object_id};

// Re-export split types for backward compatibility
pub use super::account::{Account, AccountResponse};
pub use super::reader::{Reader, ReaderResponse};

/// Blog owner user profile (aggregated from owner_profiles + readers)
#[derive(Debug, Serialize, Clone)]
pub struct User {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: bson::oid::ObjectId,
    pub username: String,
    pub name: String,
    pub introduce: String,
    pub avatar: String,
    pub mail: String,
    pub url: String,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    #[serde(rename = "lastLoginTime", serialize_with = "serialize_datetime")]
    pub last_login_time: bson::DateTime,
    #[serde(rename = "socialIds", skip_serializing_if = "Option::is_none")]
    pub social_ids: Option<UserSocialIds>,
}

/// Social account IDs for the blog owner
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserSocialIds {
    pub github: Option<String>,
    pub bilibili: Option<String>,
    pub netease: Option<String>,
    pub twitter: Option<String>,
    pub telegram: Option<String>,
    pub mail: Option<String>,
    pub rss: Option<String>,
}

/// GitHub OAuth user response
#[derive(Debug, Deserialize, Clone)]
pub struct GitHubUser {
    pub id: u64,
    pub login: String,
    pub email: Option<String>,
    pub avatar_url: String,
}
