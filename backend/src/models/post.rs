//! Post (Article) model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;
use super::Category;

/// Post (Article) model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Post {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(rename = "categoryId", serialize_with = "serialize_object_id")]
    pub category_id: ObjectId,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
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
}

/// Post with populated category information
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostWithCategory {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(rename = "categoryId", serialize_with = "serialize_object_id")]
    pub category_id: ObjectId,
    pub category: Option<Category>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default, rename = "aiSummary", skip_serializing_if = "Option::is_none")]
    pub ai_summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
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
}

impl From<Post> for PostWithCategory {
    fn from(post: Post) -> Self {
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
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostImage {
    #[serde(default)]
    pub src: Option<String>,
    pub height: Option<i32>,
    pub width: Option<i32>,
    #[serde(rename = "type")]
    pub image_type: Option<String>,
}
