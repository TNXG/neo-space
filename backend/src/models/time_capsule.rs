//! Time Capsule model - 文章时效性分析结果

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

/// 时效性等级
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TimeSensitivity {
    /// 高时效性 - 技术版本、API、框架等易过期内容
    High,
    /// 中时效性 - 部分内容可能过期
    Medium,
    /// 低时效性 - 概念性、原理性内容，不易过期
    Low,
}

/// Time Capsule 分析结果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeCapsule {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    /// 关联的文章 ID
    #[serde(rename = "refId")]
    pub ref_id: String,
    /// 关联类型 (post/note/page)
    #[serde(rename = "refType")]
    pub ref_type: String,
    /// 时效性等级
    pub sensitivity: TimeSensitivity,
    /// AI 分析理由
    pub reason: String,
    /// 检测到的易过期元素
    #[serde(default)]
    pub markers: Vec<String>,
    /// 内容哈希（用于判断是否需要重新分析）
    pub hash: String,
    /// 创建时间
    pub created: bson::Bson,
}

/// 创建 Time Capsule 的请求体
#[derive(Debug, Deserialize)]
pub struct TimeCapsuleRequest {
    /// 文章 ID
    #[serde(rename = "refId")]
    pub ref_id: String,
    /// 关联类型 (post/note/page)
    #[serde(rename = "refType", default = "default_ref_type")]
    pub ref_type: String,
}

fn default_ref_type() -> String {
    "post".to_string()
}

/// Time Capsule 分析响应
#[derive(Debug, Serialize)]
pub struct TimeCapsuleResponse {
    pub sensitivity: TimeSensitivity,
    pub reason: String,
    pub markers: Vec<String>,
    #[serde(rename = "isNew")]
    pub is_new: bool,
}
