use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

pub(super) fn default_language_code() -> String {
    "zh".to_string()
}

/// Time capsule analysis sensitivity level.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
pub enum TimeSensitivity {
    High,
    Medium,
    Low,
}

/// Time capsule analysis result.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeCapsuleResult {
    pub sensitivity: TimeSensitivity,
    pub reason: String,
    pub markers: Vec<String>,
    #[serde(rename = "isNew")]
    pub is_new: bool,
}

/// Time capsule database document.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeCapsule {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(default = "default_language_code")]
    pub lang: String,
    #[serde(rename = "sourceLang", default = "default_language_code")]
    pub source_lang: String,
    pub hash: String,
    pub sensitivity: String,
    pub reason: String,
    pub markers: Vec<String>,
    #[serde(serialize_with = "crate::models::serializers::serialize_datetime")]
    pub created: bson::DateTime,
}

/// Time capsule request body.
#[derive(Debug, Deserialize)]
pub struct TimeCapsuleRequest {
    #[serde(rename = "refId")]
    pub ref_id: String,
    #[serde(rename = "refType")]
    pub ref_type: String,
    #[serde(default = "default_language_code")]
    pub lang: String,
}

#[derive(Debug, Deserialize)]
pub struct GetTimeCapsuleParams {
    #[serde(rename = "refType")]
    pub ref_type: Option<String>,
    pub lang: Option<String>,
}
