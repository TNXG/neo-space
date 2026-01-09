//! Category model

use crate::utils::serializers::{serialize_datetime, serialize_object_id};
use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Category model
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Category {
    /// 分类唯一标识符
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    /// 分类名称
    pub name: String,
    /// 分类URL别名
    pub slug: String,
    /// 分类类型
    #[serde(rename = "type")]
    pub category_type: i32,
    /// 创建时间
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub created: bson::DateTime,
}
