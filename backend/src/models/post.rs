//! Post (Article) model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use crate::utils::serializers::*;
use super::Category;

/// Post (Article) model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
#[schema(example = json!({
    "id": "507f1f77bcf86cd799439011",
    "title": "示例文章",
    "text": "这是文章内容...",
    "slug": "example-post",
    "categoryId": "507f1f77bcf86cd799439012",
    "summary": "文章摘要",
    "tags": ["技术", "编程"],
    "created": "2024-01-01T00:00:00Z",
    "modified": "2024-01-02T00:00:00Z",
    "allowComment": true,
    "isPublished": true,
    "copyright": false,
    "meta": "元数据",
    "images": []
}))]
pub struct Post {
    /// 文章唯一标识符
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    /// 文章标题
    pub title: String,
    /// 文章内容
    pub text: String,
    /// 文章URL别名
    pub slug: String,
    /// 分类ID
    #[serde(rename = "categoryId", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub category_id: ObjectId,
    /// 文章摘要
    #[serde(default)]
    pub summary: Option<String>,
    /// 文章标签
    #[serde(default)]
    pub tags: Vec<String>,
    /// 创建时间
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    /// 修改时间
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
    /// 是否允许评论
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    /// 是否已发布
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    /// 是否有版权
    #[serde(default)]
    pub copyright: bool,
    /// 元数据
    #[serde(default)]
    pub meta: Option<String>,
    /// 文章图片
    #[serde(default)]
    pub images: Vec<PostImage>,
}

/// Post with populated category information
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct PostWithCategory {
    /// 文章唯一标识符
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    /// 文章标题
    pub title: String,
    /// 文章内容
    pub text: String,
    /// 文章URL别名
    pub slug: String,
    /// 分类ID
    #[serde(rename = "categoryId", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub category_id: ObjectId,
    /// 分类信息
    pub category: Option<Category>,
    /// 文章摘要
    #[serde(default)]
    pub summary: Option<String>,
    /// AI生成的摘要
    #[serde(default, rename = "aiSummary", skip_serializing_if = "Option::is_none")]
    pub ai_summary: Option<String>,
    /// 文章标签
    #[serde(default)]
    pub tags: Vec<String>,
    /// 创建时间
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    /// 修改时间
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
    /// 是否允许评论
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    /// 是否已发布
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    /// 是否有版权
    #[serde(default)]
    pub copyright: bool,
    /// 元数据
    #[serde(default)]
    pub meta: Option<String>,
    /// 文章图片
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

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct PostImage {
    /// 图片URL
    #[serde(default)]
    pub src: Option<String>,
    /// 图片高度
    pub height: Option<i32>,
    /// 图片宽度
    pub width: Option<i32>,
    /// 图片类型
    #[serde(rename = "type")]
    pub image_type: Option<String>,
}
