use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub r#ref: ObjectId,
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
    pub created: mongodb::bson::DateTime,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<ObjectId>,
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
}

#[derive(Debug, Deserialize)]
pub struct UpdateCommentRequest {
    pub text: String,
}

#[derive(Debug, Serialize)]
pub struct CommentListResponse {
    pub comments: Vec<CommentTree>,
    pub count: i64,
}
