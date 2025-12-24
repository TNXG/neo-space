//! Account model for OAuth provider linking

use crate::utils::serializers::*;
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/// Account model - links OAuth providers to Reader
/// This is used for MongoDB storage - keeps native BSON types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(default)]
    pub provider: String, // "github" or "qq"
    #[serde(rename = "accountId", default)]
    pub account_id: String, // GitHub user ID or QQ openid
    #[serde(rename = "accessToken", default)]
    pub access_token: String,
    #[serde(default)]
    pub scope: Option<String>,
    /// OAuth 用户昵称（用于跳过绑定时创建 Reader）
    #[serde(rename = "oauthName", default)]
    pub oauth_name: Option<String>,
    /// OAuth 用户邮箱（用于跳过绑定时创建 Reader）
    #[serde(rename = "oauthEmail", default)]
    pub oauth_email: Option<String>,
    /// OAuth 用户头像（用于跳过绑定时创建 Reader）
    #[serde(rename = "oauthAvatar", default)]
    pub oauth_avatar: Option<String>,
    /// OAuth 用户 handle（用于跳过绑定时创建 Reader）
    #[serde(rename = "oauthHandle", default)]
    pub oauth_handle: Option<String>,
    #[serde(
        rename = "createdAt",
        default = "default_account_datetime",
        deserialize_with = "deserialize_flexible_datetime"
    )]
    pub created_at: bson::DateTime,
    #[serde(
        rename = "updatedAt",
        default = "default_account_datetime",
        deserialize_with = "deserialize_flexible_datetime"
    )]
    pub updated_at: bson::DateTime,
}

fn default_account_datetime() -> bson::DateTime {
    bson::DateTime::now()
}

/// Account response model for API responses
/// This converts BSON types to JSON-friendly strings
#[derive(Debug, Serialize, Clone)]
pub struct AccountResponse {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    #[serde(rename = "userId", serialize_with = "serialize_object_id")]
    pub user_id: ObjectId,
    pub provider: String,
    #[serde(rename = "accountId")]
    pub account_id: String,
    #[serde(rename = "accessToken")]
    pub access_token: String,
    pub scope: Option<String>,
    #[serde(rename = "createdAt", serialize_with = "serialize_datetime")]
    pub created_at: bson::DateTime,
    #[serde(rename = "updatedAt", serialize_with = "serialize_datetime")]
    pub updated_at: bson::DateTime,
}

impl From<Account> for AccountResponse {
    fn from(account: Account) -> Self {
        Self {
            id: account.id,
            user_id: account.user_id,
            provider: account.provider,
            account_id: account.account_id,
            access_token: account.access_token,
            scope: account.scope,
            created_at: account.created_at,
            updated_at: account.updated_at,
        }
    }
}

impl Account {
    /// Create a new Account for GitHub OAuth with user info
    pub fn new_github_with_info(
        user_id: ObjectId,
        github_id: u64,
        access_token: String,
        scope: Option<String>,
        name: String,
        email: Option<String>,
        avatar: String,
        handle: String,
    ) -> Self {
        Self {
            id: ObjectId::new(),
            user_id,
            provider: "github".to_string(),
            account_id: github_id.to_string(),
            access_token,
            scope,
            oauth_name: Some(name),
            oauth_email: email.or_else(|| Some(format!("{}@github.oauth", github_id))),
            oauth_avatar: Some(avatar),
            oauth_handle: Some(handle),
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }

    /// Create a new Account for QQ OAuth with user info
    pub fn new_qq_with_info(
        user_id: ObjectId,
        openid: String,
        access_token: String,
        name: String,
        avatar: String,
    ) -> Self {
        Self {
            id: ObjectId::new(),
            user_id,
            provider: "qq".to_string(),
            account_id: openid.clone(),
            access_token,
            scope: None,
            oauth_name: Some(name.clone()),
            oauth_email: Some(format!("{}@qq.oauth", openid)),
            oauth_avatar: Some(avatar),
            oauth_handle: Some(crate::models::Reader::generate_handle(&name)),
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }
}

impl Default for Account {
    fn default() -> Self {
        Self {
            id: ObjectId::new(),
            user_id: ObjectId::new(),
            provider: String::new(),
            account_id: String::new(),
            access_token: String::new(),
            scope: None,
            oauth_name: None,
            oauth_email: None,
            oauth_avatar: None,
            oauth_handle: None,
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }
}
