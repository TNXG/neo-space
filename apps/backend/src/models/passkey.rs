//! Passkey 持久化模型与后台安全摘要。

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use webauthn_rs::prelude::Passkey;

use super::serializers::{serialize_datetime, serialize_optional_datetime};

/// MongoDB 中持久化的 Passkey 凭据。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredPasskey {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub name: String,
    pub credential: Passkey,
    #[serde(rename = "createdAt")]
    pub created_at: bson::DateTime,
    #[serde(rename = "lastUsedAt", default)]
    pub last_used_at: Option<bson::DateTime>,
}

/// 后台展示使用的 Passkey 摘要，不暴露公钥和内部计数器。
#[derive(Debug, Serialize)]
pub struct PasskeySummary {
    #[serde(rename = "_id")]
    pub id: String,
    pub name: String,
    #[serde(rename = "createdAt", serialize_with = "serialize_datetime")]
    pub created_at: bson::DateTime,
    #[serde(rename = "lastUsedAt", serialize_with = "serialize_optional_datetime")]
    pub last_used_at: Option<bson::DateTime>,
}
