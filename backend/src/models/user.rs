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

/// Reader model (non-sensitive data only)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Reader {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub email: String,
    pub name: String,
    pub handle: String,
    pub image: String,
    #[serde(rename = "isOwner")]
    pub is_owner: bool,
    #[serde(rename = "emailVerified", default)]
    pub email_verified: Option<bool>,
    #[serde(rename = "createdAt", serialize_with = "serialize_datetime")]
    pub created_at: bson::DateTime,
    #[serde(rename = "updatedAt", serialize_with = "serialize_datetime")]
    pub updated_at: bson::DateTime,
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
