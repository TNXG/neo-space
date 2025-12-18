//! Page model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

/// Page model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Page {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    #[serde(rename = "commentsIndex", default)]
    pub comments_index: i32,
}
