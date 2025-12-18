//! Link (Friend) model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

/// Link (Friend) model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Link {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub name: String,
    pub url: String,
    pub avatar: String,
    pub description: String,
    pub state: i32,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    pub email: Option<String>,
}
