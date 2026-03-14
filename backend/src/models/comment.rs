//! Comment models

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

/// Comment state constants
/// - 0: Unread + Normal
/// - 1: Read + Normal
/// - 2: Spam
pub struct CommentState;

impl CommentState {
    pub const UNREAD: i32 = 0;
    pub const READ: i32 = 1;
    pub const SPAM: i32 = 2;
}

/// User agent information (browser/OS)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UAInfo {
    pub browser: String,
    pub browser_version: String,
    pub os: String,
    pub os_version: String,
    pub device: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Reference ID - can be ObjectId (for posts/notes) or String (for custom identifiers like "friends")
    pub r#ref: bson::Bson,
    #[serde(rename = "refType")]
    pub ref_type: String,
    pub author: String,
    pub mail: String,
    pub text: String,
    pub state: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<ObjectId>>,
    #[serde(rename = "commentsIndex")]
    pub comments_index: i32,
    pub key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent: Option<String>,
    pub pin: bool,
    #[serde(rename = "isWhispers")]
    pub is_whispers: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar: Option<String>,
    pub created: bson::DateTime,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<ObjectId>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ua: Option<UAInfo>,
}

impl Default for Comment {
    fn default() -> Self {
        Self {
            id: None,
            r#ref: bson::Bson::ObjectId(ObjectId::new()),
            ref_type: String::new(),
            author: String::new(),
            mail: String::new(),
            text: String::new(),
            state: 0,
            children: None,
            comments_index: 0,
            key: String::new(),
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
            ua: None,
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
