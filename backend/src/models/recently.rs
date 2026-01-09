//! Recently (Moments) model

use crate::utils::serializers::{
    serialize_datetime, serialize_object_id, serialize_optional_object_id,
};
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Recently model (Moments)
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Recently {
    /// 动态唯一标识符
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    /// 动态内容
    pub content: String,
    /// 点赞数
    pub up: i32,
    /// 踩数
    pub down: i32,
    /// 创建时间
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
    /// 关联ID
    #[serde(default, serialize_with = "serialize_optional_object_id")]
    #[schema(value_type = Option<String>)]
    pub ref_id: Option<ObjectId>,
    /// 关联类型
    #[serde(default, rename = "refType")]
    pub ref_type: Option<String>,
}
