//! Recently (Moments) model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

/// Recently model (Moments)
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Recently {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub content: String,
    pub up: i32,
    pub down: i32,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_object_id")]
    pub ref_id: Option<ObjectId>,
    #[serde(default, rename = "refType")]
    pub ref_type: Option<String>,
}
