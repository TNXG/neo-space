//! Reader model for authenticated users/visitors

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::serializers::{serialize_datetime, serialize_object_id};

/// Reader model (non-sensitive data only)
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct Reader {
    #[serde(rename = "_id")]
    #[schema(value_type = String)]
    pub id: ObjectId,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub handle: String,
    #[serde(default)]
    pub image: String,
    #[serde(rename = "isOwner", default)]
    pub is_owner: bool,
    #[serde(rename = "emailVerified", default)]
    pub email_verified: Option<bool>,
    #[serde(
        rename = "createdAt",
        default = "default_datetime",
        deserialize_with = "crate::models::serializers::deserialize_flexible_datetime"
    )]
    #[schema(value_type = String)]
    pub created_at: bson::DateTime,
    #[serde(
        rename = "updatedAt",
        default = "default_datetime",
        deserialize_with = "crate::models::serializers::deserialize_flexible_datetime"
    )]
    #[schema(value_type = String)]
    pub updated_at: bson::DateTime,
}

fn default_datetime() -> bson::DateTime {
    bson::DateTime::now()
}

/// Reader response model for API responses
#[derive(Debug, Serialize, Clone)]
pub struct ReaderResponse {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub email: String,
    pub name: String,
    pub handle: String,
    pub image: String,
    #[serde(rename = "isOwner")]
    pub is_owner: bool,
    #[serde(rename = "emailVerified")]
    pub email_verified: Option<bool>,
    #[serde(rename = "createdAt", serialize_with = "serialize_datetime")]
    pub created_at: bson::DateTime,
    #[serde(rename = "updatedAt", serialize_with = "serialize_datetime")]
    pub updated_at: bson::DateTime,
}

impl From<Reader> for ReaderResponse {
    fn from(reader: Reader) -> Self {
        Self {
            id: reader.id,
            email: reader.email,
            name: reader.name,
            handle: reader.handle,
            image: reader.image,
            is_owner: reader.is_owner,
            email_verified: reader.email_verified,
            created_at: reader.created_at,
            updated_at: reader.updated_at,
        }
    }
}

impl Reader {
    /// Generate a safe handle (slug) from a name
    pub fn generate_handle(name: &str) -> String {
        name.to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
            .collect::<String>()
            .trim_matches(|c| c == '-' || c == '_')
            .to_string()
    }

    /// Create a new anonymous Reader
    pub fn new_anonymous(name: String, email: String) -> Self {
        Self {
            id: ObjectId::new(),
            email,
            name: name.clone(),
            handle: Self::generate_handle(&name),
            image: String::new(),
            is_owner: false,
            email_verified: Some(false),
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }
}

impl Default for Reader {
    fn default() -> Self {
        Self {
            id: ObjectId::new(),
            email: String::new(),
            name: String::new(),
            handle: String::new(),
            image: String::new(),
            is_owner: false,
            email_verified: None,
            created_at: bson::DateTime::now(),
            updated_at: bson::DateTime::now(),
        }
    }
}
