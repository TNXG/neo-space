//! User and Reader models

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

/// User model (non-sensitive data only)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct User {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
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
    #[serde(rename = "socialIds", default)]
    pub social_ids: Option<UserSocialIds>,
}

impl Default for User {
    fn default() -> Self {
        Self {
            id: ObjectId::new(),
            username: String::new(),
            name: String::new(),
            introduce: String::new(),
            avatar: String::new(),
            mail: String::new(),
            url: String::new(),
            created: bson::DateTime::now(),
            last_login_time: bson::DateTime::now(),
            social_ids: None,
        }
    }
}

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
    pub name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: String,
}

/// QQ OAuth user response
#[derive(Debug, Deserialize, Clone)]
pub struct QQUser {
    pub nickname: String,
    pub figureurl_qq_1: String,
    pub figureurl_qq_2: Option<String>,
}

/// Reader model (non-sensitive data only)
/// This is used for MongoDB storage - keeps native BSON types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Reader {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub handle: String,
    #[serde(default)]
    pub image: String,
    #[serde(rename = "isOwner", default)]
    pub is_owner: bool,
    #[serde(rename = "emailVerified", default)]
    pub email_verified: Option<bool>,
    #[serde(rename = "createdAt", default = "default_datetime", deserialize_with = "deserialize_flexible_datetime")]
    pub created_at: bson::DateTime,
    #[serde(rename = "updatedAt", default = "default_datetime", deserialize_with = "deserialize_flexible_datetime")]
    pub updated_at: bson::DateTime,
}

/// 默认日期时间（用于缺失字段）
fn default_datetime() -> bson::DateTime {
    bson::DateTime::now()
}

/// Reader response model for API responses
/// This converts BSON types to JSON-friendly strings
#[derive(Debug, Serialize, Clone)]
pub struct ReaderResponse {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub email: String,
    pub name: String,
    pub handle: String,
    pub image: String,
    #[serde(rename = "isOwner")]
    pub is_owner: bool,
    #[serde(rename = "emailVerified")]
    pub email_verified: Option<bool>,
    #[serde(rename = "createdAt", serialize_with = "serialize_datetime")]
    pub created_at: bson::DateTime,
    #[serde(rename = "updatedAt", serialize_with = "serialize_datetime")]
    pub updated_at: bson::DateTime,
}

impl From<Reader> for ReaderResponse {
    fn from(reader: Reader) -> Self {
        Self {
            id: reader.id,
            email: reader.email,
            name: reader.name,
            handle: reader.handle,
            image: reader.image,
            is_owner: reader.is_owner,
            email_verified: reader.email_verified,
            created_at: reader.created_at,
            updated_at: reader.updated_at,
        }
    }
}

impl Reader {
    /// Generate a safe handle (slug) from a name
    /// Filters out non-alphanumeric characters except hyphens and underscores
    pub fn generate_handle(name: &str) -> String {
        name.to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>()
            .trim_matches(|c| c == '-' || c == '_')
            .to_string()
    }

    /// Create a new anonymous Reader
    pub fn new_anonymous(name: String, email: String) -> Self {
        Self {
            id: ObjectId::new(),
            email,
            name: name.clone(),
            handle: Self::generate_handle(&name),
            image: String::new(),
            is_owner: false,
            email_verified: Some(false),
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }
}

impl Default for Reader {
    fn default() -> Self {
        Self {
            id: ObjectId::new(),
            email: String::new(),
            name: String::new(),
            handle: String::new(),
            image: String::new(),
            is_owner: false,
            email_verified: None,
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }
}
