//! Extended content models: Say / Topic / Snippet / Project / Draft / Webhook / Subscribe
//!
//! 这些模型补齐 admin 管理面板所依赖的内容实体。命名与 mx-admin 保持一致以便前端对接。

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::serializers::{
    serialize_datetime, serialize_object_id, serialize_optional_datetime,
    serialize_optional_object_id,
};

// ==================== Say ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Say {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub text: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
}

// ==================== Topic ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Topic {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub name: String,
    pub slug: String,
    pub introduce: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
}

// ==================== Snippet ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Snippet {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub name: String,
    pub reference: String,
    #[serde(rename = "type")]
    pub snippet_type: String,
    pub raw: String,
    #[serde(default)]
    pub method: Option<String>,
    #[serde(rename = "isPublic", default)]
    pub is_public: bool,
    #[serde(rename = "isPrivate", default)]
    pub is_private: bool,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
}

// ==================== Project ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Project {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub name: String,
    pub description: String,
    pub text: String,
    #[serde(rename = "previewUrl", default)]
    pub preview_url: Option<String>,
    #[serde(rename = "docUrl", default)]
    pub doc_url: Option<String>,
    #[serde(rename = "projectUrl", default)]
    pub project_url: Option<String>,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default)]
    pub avatar: Option<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
}

// ==================== Draft ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct DraftHistoryEntry {
    pub version: i32,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub text: String,
    #[serde(rename = "contentFormat", default)]
    pub content_format: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(rename = "typeSpecificData", default)]
    #[schema(value_type = Object)]
    pub type_specific_data: Option<bson::Bson>,
    #[serde(serialize_with = "serialize_datetime", rename = "savedAt")]
    #[schema(value_type = String)]
    pub saved_at: bson::DateTime,
    #[serde(rename = "isFullSnapshot", default)]
    pub is_full_snapshot: bool,
    #[serde(rename = "refVersion", default)]
    pub ref_version: Option<i32>,
    #[serde(rename = "baseVersion", default)]
    pub base_version: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Draft {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(
        default,
        serialize_with = "serialize_optional_object_id",
        rename = "refId"
    )]
    #[schema(value_type = Option<String>)]
    pub ref_id: Option<ObjectId>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(rename = "contentFormat", default)]
    pub content_format: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    #[schema(value_type = Vec<Object>)]
    pub images: Vec<bson::Bson>,
    #[serde(default)]
    #[schema(value_type = Object)]
    pub meta: Option<bson::Bson>,
    #[serde(rename = "typeSpecificData", default)]
    #[schema(value_type = Object)]
    pub type_specific_data: Option<bson::Bson>,
    #[serde(default = "default_draft_version")]
    pub version: i32,
    #[serde(default)]
    pub history: Vec<DraftHistoryEntry>,
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub updated: Option<bson::DateTime>,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
    #[serde(rename = "publishedVersion", default)]
    pub published_version: Option<i32>,
}

fn default_draft_version() -> i32 {
    1
}

// ==================== Webhook ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Webhook {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub events: Vec<String>,
    #[serde(default)]
    pub secret: Option<String>,
    #[serde(default)]
    pub enabled: bool,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
}

// ==================== Subscribe ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Subscriber {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub email: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub types: Vec<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
}

// ==================== Token ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct ApiToken {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub name: String,
    pub token: String,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub expired: Option<bson::DateTime>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
}

// ==================== Cron Task ====================

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct CronTaskRecord {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    #[serde(rename = "type")]
    pub task_type: String,
    pub status: String,
    #[serde(default)]
    #[schema(value_type = Object)]
    pub payload: Option<bson::Document>,
    #[serde(default)]
    pub progress: Option<i32>,
    #[serde(rename = "progressMessage", default)]
    pub progress_message: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "startedAt", default)]
    pub started_at: Option<i64>,
    #[serde(rename = "completedAt", default)]
    pub completed_at: Option<i64>,
}
