//! Content models: Post, Note, Page, Category, Recently

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::serializers::{
    serialize_datetime, serialize_object_id, serialize_optional_datetime,
    serialize_optional_object_id,
};

fn default_language_code() -> String {
    "zh".to_string()
}

// ==================== AI Summary ====================

/// AI Summary model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiSummary {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    #[serde(rename = "refId")]
    pub ref_id: String,
    pub summary: String,
    pub lang: String,
    pub hash: String,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
}

/// AI Translation model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiTranslation {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub hash: String,
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    pub lang: String,
    #[serde(rename = "sourceLang")]
    pub source_lang: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(
        rename = "sourceModified",
        default,
        serialize_with = "serialize_optional_datetime"
    )]
    pub source_modified: Option<bson::DateTime>,
    #[serde(rename = "aiModel", default)]
    pub ai_model: Option<String>,
    #[serde(rename = "aiProvider", default)]
    pub ai_provider: Option<String>,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
}

// ==================== Category ====================

/// Category model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Category {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub name: String,
    pub slug: String,
    #[serde(rename = "type")]
    pub category_type: i32,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
}

// ==================== Post ====================

/// Post (Article) model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Post {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(rename = "categoryId", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub category_id: ObjectId,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    #[serde(default)]
    pub copyright: bool,
    #[serde(default)]
    pub meta: Option<String>,
    #[serde(default)]
    pub images: Vec<PostImage>,
    #[serde(default = "default_language_code")]
    pub lang: String,
    #[serde(rename = "sourceLang", default = "default_language_code")]
    pub source_lang: String,
    #[serde(rename = "isAiTranslated", default)]
    pub is_ai_translated: bool,
}

/// Post with populated category information
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct PostWithCategory {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(rename = "categoryId", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub category_id: ObjectId,
    pub category: Option<Category>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default, rename = "aiSummary", skip_serializing_if = "Option::is_none")]
    pub ai_summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    #[serde(default)]
    pub copyright: bool,
    #[serde(default)]
    pub meta: Option<String>,
    #[serde(default)]
    pub images: Vec<PostImage>,
    #[serde(default = "default_language_code")]
    pub lang: String,
    #[serde(rename = "sourceLang", default = "default_language_code")]
    pub source_lang: String,
    #[serde(rename = "isAiTranslated", default)]
    pub is_ai_translated: bool,
}

impl From<Post> for PostWithCategory {
    fn from(post: Post) -> Self {
        let lang = post.lang.clone();
        let source_lang = post.source_lang.clone();

        Self {
            id: post.id,
            title: post.title,
            text: post.text,
            slug: post.slug,
            category_id: post.category_id,
            category: None,
            summary: post.summary,
            ai_summary: None,
            tags: post.tags,
            created: post.created,
            modified: post.modified,
            allow_comment: post.allow_comment,
            is_published: post.is_published,
            copyright: post.copyright,
            meta: post.meta,
            images: post.images,
            lang,
            source_lang,
            is_ai_translated: false,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct PostImage {
    #[serde(default)]
    pub src: Option<String>,
    pub height: Option<i32>,
    pub width: Option<i32>,
    #[serde(rename = "type")]
    pub image_type: Option<String>,
}

// ==================== Note ====================

/// Note (Diary) model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Note {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub nid: i32,
    pub title: String,
    pub text: String,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
    #[serde(default)]
    pub mood: Option<String>,
    #[serde(default)]
    pub weather: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    #[serde(default)]
    pub bookmark: bool,
    #[serde(default)]
    pub images: Vec<NoteImage>,
    #[serde(rename = "commentsIndex", default)]
    pub comments_index: i32,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(
        rename = "publicAt",
        default,
        serialize_with = "serialize_optional_datetime"
    )]
    #[schema(value_type = Option<String>)]
    pub public_at: Option<bson::DateTime>,
    #[serde(default)]
    pub coordinates: Option<String>,
    #[serde(default)]
    pub count: Option<NoteCount>,
    #[serde(default, rename = "aiSummary", skip_serializing_if = "Option::is_none")]
    pub ai_summary: Option<String>,
    #[serde(default = "default_language_code")]
    pub lang: String,
    #[serde(rename = "sourceLang", default = "default_language_code")]
    pub source_lang: String,
    #[serde(rename = "isAiTranslated", default)]
    pub is_ai_translated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct NoteImage {
    #[serde(default)]
    pub src: Option<String>,
    pub height: Option<i32>,
    pub width: Option<i32>,
    #[serde(rename = "type")]
    pub image_type: Option<String>,
    #[serde(default)]
    pub accent: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct NoteCount {
    pub read: i32,
    pub like: i32,
}

// ==================== Page ====================

/// Page model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Page {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    #[serde(rename = "commentsIndex", default)]
    pub comments_index: i32,
}

// ==================== Recently (Moments) ====================

/// Recently model (Moments)
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Recently {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    pub content: String,
    pub up: i32,
    pub down: i32,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_object_id")]
    #[schema(value_type = Option<String>)]
    pub ref_id: Option<ObjectId>,
    #[serde(default, rename = "refType")]
    pub ref_type: Option<String>,
}
