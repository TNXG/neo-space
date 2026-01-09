//! Page model

use crate::utils::serializers::{serialize_datetime, serialize_object_id};
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Page model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Page {
    /// 页面唯一标识符
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    /// 页面标题
    pub title: String,
    /// 页面内容
    pub text: String,
    /// 页面URL别名
    pub slug: String,
    /// 创建时间
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    /// 是否允许评论
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    /// 评论索引
    #[serde(rename = "commentsIndex", default)]
    pub comments_index: i32,
}
