//! Link (Friend) model
#![allow(unused)]

use crate::utils::serializers::{serialize_object_id, serialize_datetime, deserialize_flexible_datetime};
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// 友链状态
/// - 0: 正常
/// - 1: 待审核
/// - 2: 过时/失效
/// - 3: 封禁
/// - 4: 拒绝
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LinkState;

impl LinkState {
    pub const NORMAL: i32 = 0;
    pub const PENDING: i32 = 1;
    pub const OUTDATED: i32 = 2;
    pub const BANNED: i32 = 3;
    pub const REJECTED: i32 = 4;
}

/// 友链类型
/// - 0: 朋友（默认）
/// - 1: 收藏
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LinkType;

impl LinkType {
    pub const FRIEND: i32 = 0;
    pub const COLLECTION: i32 = 1;
}

/// Link (Friend) model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
#[schema(example = json!({
    "id": "507f1f77bcf86cd799439011",
    "name": "示例博客",
    "url": "https://example.com",
    "avatar": "https://example.com/avatar.jpg",
    "description": "这是一个示例博客",
    "state": 0,
    "type": 0,
    "created": "2024-01-01T00:00:00Z",
    "email": "example@example.com",
    "rssurl": "https://example.com/feed.xml",
    "techstack": ["React", "Node.js"]
}))]
pub struct Link {
    /// 友链唯一标识符
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    /// 友链名称
    pub name: String,
    /// 友链URL
    pub url: String,
    /// 头像URL
    #[serde(default)]
    pub avatar: String,
    /// 友链描述
    #[serde(default)]
    pub description: String,
    /// 状态: 0=正常, 1=待审核, 2=过时, 3=封禁, 4=拒绝
    #[serde(default)]
    pub state: i32,
    /// 类型: 0=朋友, 1=收藏
    #[serde(default)]
    pub r#type: i32,
    /// 创建时间
    #[serde(serialize_with = "serialize_datetime", deserialize_with = "deserialize_flexible_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    /// 联系邮箱
    pub email: Option<String>,
    /// RSS订阅地址
    pub rssurl: Option<String>,
    /// 技术栈
    pub techstack: Option<Vec<String>>,
}

/// 友链申请请求
#[derive(Debug, Deserialize, ToSchema)]
#[schema(example = json!({
    "name": "示例博客",
    "url": "https://example.com",
    "avatar": "https://example.com/avatar.jpg",
    "description": "这是一个示例博客",
    "email": "example@example.com",
    "rssurl": "https://example.com/feed.xml",
    "techstack": ["React", "Node.js"]
}))]
pub struct LinkApplyRequest {
    /// 友链名称
    pub name: String,
    /// 友链URL
    pub url: String,
    /// 头像URL
    pub avatar: String,
    /// 友链描述
    pub description: String,
    /// 联系邮箱
    pub email: String,
    /// RSS订阅地址
    pub rssurl: Option<String>,
    /// 技术栈
    pub techstack: Option<Vec<String>>,
}
