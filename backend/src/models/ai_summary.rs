//! AI Summary model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

/// AI Summary model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiSummary {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    /// Reference ID (post/note/page ID as string)
    #[serde(rename = "refId")]
    pub ref_id: String,
    /// AI generated summary
    pub summary: String,
    /// Language code (zh/en/ja)
    pub lang: String,
    /// Content hash for cache invalidation
    pub hash: String,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
}
