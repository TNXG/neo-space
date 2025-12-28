//! Note (Diary) model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use crate::utils::serializers::*;

/// Note (Diary) model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Note {
    /// 日记唯一标识符
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    /// 日记数字ID
    pub nid: i32,
    /// 日记标题
    pub title: String,
    /// 日记内容
    pub text: String,
    /// 创建时间
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    /// 修改时间
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub modified: Option<bson::DateTime>,
    /// 心情
    #[serde(default)]
    pub mood: Option<String>,
    /// 天气
    #[serde(default)]
    pub weather: Option<String>,
    /// 位置
    #[serde(default)]
    pub location: Option<String>,
    /// 是否允许评论
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    /// 是否已发布
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    /// 是否收藏
    #[serde(default)]
    pub bookmark: bool,
    /// 日记图片
    #[serde(default)]
    pub images: Vec<NoteImage>,
    /// 评论索引
    #[serde(rename = "commentsIndex", default)]
    pub comments_index: i32,
    /// 密码保护
    #[serde(default)]
    pub password: Option<String>,
    /// 公开时间
    #[serde(rename = "publicAt", default, serialize_with = "serialize_optional_datetime")]
    #[schema(value_type = Option<String>)]
    pub public_at: Option<bson::DateTime>,
    /// 坐标
    #[serde(default)]
    pub coordinates: Option<String>,
    /// 统计信息
    #[serde(default)]
    pub count: Option<NoteCount>,
    /// AI生成的摘要
    #[serde(default, rename = "aiSummary", skip_serializing_if = "Option::is_none")]
    pub ai_summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct NoteImage {
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
    /// 主色调
    #[serde(default)]
    pub accent: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct NoteCount {
    /// 阅读数
    pub read: i32,
    /// 点赞数
    pub like: i32,
}
