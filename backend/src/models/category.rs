//! Category model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

/// Category model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub name: String,
    pub slug: String,
    #[serde(rename = "type")]
    pub category_type: i32,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
}
