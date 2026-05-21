//! Comment models

use bson::{Bson, oid::ObjectId};
use serde::{Deserialize, Serialize};

use crate::models::serializers::{
    deserialize_flexible_datetime, deserialize_flexible_optional_datetime,
};

/// Comment state constants
/// - 0: Unread + Normal
/// - 1: Read + Normal
/// - 2: Spam
pub struct CommentState;

impl CommentState {
    pub const UNREAD: i32 = 0;
    pub const READ: i32 = 1;
    pub const SPAM: i32 = 2;
    pub const PENDING: i32 = 3;
}

/// User agent information (browser/OS)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UAClientHintsInfo {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mobile: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub platform_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub architecture: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bitness: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub wow64: Option<bool>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub full_version_list: Vec<UABrandVersion>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub brands: Vec<UABrandVersion>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UABrandVersion {
    pub brand: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UAInfo {
    pub browser: String,
    pub browser_version: String,
    pub os: String,
    pub os_version: String,
    pub device: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub raw_user_agent: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_hints: Option<UAClientHintsInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Reference ID - can be ObjectId (for posts/notes) or String (for custom identifiers like "friends")
    #[serde(rename = "ref", default)]
    pub r#ref: Bson,
    #[serde(rename = "refType", default)]
    pub ref_type: String,
    #[serde(rename = "refId", skip_serializing_if = "Option::is_none")]
    pub ref_id: Option<String>,
    #[serde(default)]
    pub author: String,
    #[serde(default, alias = "email")]
    pub mail: String,
    #[serde(default)]
    pub text: String,
    #[serde(default)]
    pub state: i32,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", alias = "userAgent")]
    pub agent: Option<String>,
    #[serde(default)]
    pub pin: bool,
    #[serde(rename = "isWhispers", default)]
    pub is_whispers: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    #[serde(deserialize_with = "deserialize_flexible_datetime")]
    pub created: bson::DateTime,
    #[serde(skip_serializing_if = "Option::is_none", alias = "localtion")]
    pub location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(
        rename = "parentCommentId",
        alias = "parent",
        alias = "parentId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub parent: Option<ObjectId>,
    #[serde(
        rename = "rootCommentId",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub root_comment_id: Option<ObjectId>,
    #[serde(rename = "replyCount", default)]
    pub reply_count: i32,
    #[serde(
        rename = "latestReplyAt",
        default,
        deserialize_with = "deserialize_flexible_optional_datetime",
        skip_serializing_if = "Option::is_none"
    )]
    pub latest_reply_at: Option<bson::DateTime>,
    #[serde(rename = "isDeleted", default)]
    pub is_deleted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ua: Option<UAInfo>,
}

impl Default for Comment {
    fn default() -> Self {
        Self {
            id: None,
            r#ref: Bson::Null,
            ref_type: String::new(),
            ref_id: None,
            author: String::new(),
            mail: String::new(),
            text: String::new(),
            state: 0,
            status: None,
            ip: None,
            agent: None,
            pin: false,
            is_whispers: false,
            source: None,
            avatar: None,
            created: bson::DateTime::now(),
            location: None,
            url: None,
            parent: None,
            root_comment_id: None,
            reply_count: 0,
            latest_reply_at: None,
            is_deleted: false,
            ua: None,
        }
    }
}

impl Comment {
    pub fn effective_state(&self) -> i32 {
        match self.status.as_deref() {
            Some("approved") | Some("read") => CommentState::READ,
            Some("pending") => CommentState::PENDING,
            Some("spam") | Some("rejected") => CommentState::SPAM,
            _ => self.state,
        }
    }

    pub fn reference_string(&self) -> String {
        match &self.r#ref {
            Bson::ObjectId(oid) => oid.to_hex(),
            Bson::String(value) => value.clone(),
            Bson::Null => self.ref_id.clone().unwrap_or_default(),
            other => other.to_string(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CommentTree {
    #[serde(rename = "_id")]
    pub id: String,
    pub r#ref: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    pub author: String,
    pub text: String,
    pub state: i32,
    pub children: Vec<CommentTree>,
    #[serde(rename = "commentsIndex")]
    pub comments_index: i32,
    pub key: String,
    pub pin: bool,
    #[serde(rename = "isWhispers")]
    pub is_whispers: bool,
    #[serde(rename = "isAdmin", skip_serializing_if = "Option::is_none")]
    pub is_admin: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    pub created: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ua: Option<UAInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentRequest {
    pub r#ref: String,
    pub ref_type: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub mail: Option<String>,
    pub text: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub parent: Option<String>,
    #[serde(default)]
    pub turnstile_token: Option<String>,
    #[serde(default)]
    pub ua: Option<UAInfo>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentRequest {
    pub text: String,
}

#[derive(Debug, Serialize, Default)]
pub struct CommentListResponse {
    pub comments: Vec<CommentTree>,
    pub count: i64,
}
