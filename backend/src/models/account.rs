//! Account model for OAuth provider linking

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

use super::serializers::{serialize_datetime, serialize_object_id};

/// User profile information from OAuth providers
#[derive(Debug, Clone)]
pub struct OAuthUserProfile {
    pub name: String,
    pub email: Option<String>,
    pub avatar: String,
    pub handle: String,
}

/// Account model for OAuth provider linking
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Account {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    #[serde(default)]
    pub provider: String,
    #[serde(rename = "accountId", default)]
    pub account_id: String,
    #[serde(rename = "accessToken", default)]
    pub access_token: String,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(rename = "oauthName", default)]
    pub oauth_name: Option<String>,
    #[serde(rename = "oauthEmail", default)]
    pub oauth_email: Option<String>,
    #[serde(rename = "oauthAvatar", default)]
    pub oauth_avatar: Option<String>,
    #[serde(rename = "oauthHandle", default)]
    pub oauth_handle: Option<String>,
    #[serde(
        rename = "createdAt",
        default = "default_account_datetime",
        deserialize_with = "crate::models::serializers::deserialize_flexible_datetime"
    )]
    pub created_at: bson::DateTime,
    #[serde(
        rename = "updatedAt",
        default = "default_account_datetime",
        deserialize_with = "crate::models::serializers::deserialize_flexible_datetime"
    )]
    pub updated_at: bson::DateTime,
}

fn default_account_datetime() -> bson::DateTime {
    bson::DateTime::now()
}

/// Account response model for API responses
#[derive(Debug, Serialize, Clone)]
pub struct AccountResponse {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    #[serde(rename = "userId", serialize_with = "serialize_object_id")]
    pub user_id: ObjectId,
    pub provider: String,
    #[serde(rename = "accountId")]
    pub account_id: String,
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
        profile: OAuthUserProfile,
    ) -> Self {
        Self {
            id: ObjectId::new(),
            user_id,
            provider: "github".to_string(),
            account_id: github_id.to_string(),
            access_token,
            scope,
            oauth_name: Some(profile.name),
            oauth_email: profile
                .email
                .or_else(|| Some(format!("{github_id}@github.oauth"))),
            oauth_avatar: Some(profile.avatar),
            oauth_handle: Some(profile.handle),
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }

    /// Create a new Account for QQ OAuth with user info
    pub fn new_qq_with_info(
        user_id: ObjectId,
        openid: String,
        access_token: String,
        profile: OAuthUserProfile,
    ) -> Self {
        Self {
            id: ObjectId::new(),
            user_id,
            provider: "qq".to_string(),
            account_id: openid.clone(),
            access_token,
            scope: None,
            oauth_name: Some(profile.name.clone()),
            oauth_email: Some(format!("{openid}@qq.oauth")),
            oauth_avatar: Some(profile.avatar),
            oauth_handle: Some(profile.handle),
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
