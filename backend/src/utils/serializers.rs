//! Serialization helpers for BSON types

use bson::oid::ObjectId;
use serde::Serializer;

/// Serialize ObjectId as a string
pub fn serialize_object_id<S>(oid: &ObjectId, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&oid.to_hex())
}

/// Serialize Option<ObjectId> as an optional string
pub fn serialize_optional_object_id<S>(
    oid: &Option<ObjectId>,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match oid {
        Some(id) => serializer.serialize_some(&id.to_hex()),
        None => serializer.serialize_none(),
    }
}

/// Serialize bson::DateTime as ISO 8601 string
pub fn serialize_datetime<S>(dt: &bson::DateTime, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&dt.to_chrono().to_rfc3339())
}

/// Serialize Option<bson::DateTime> as optional ISO 8601 string
pub fn serialize_optional_datetime<S>(
    dt: &Option<bson::DateTime>,
    serializer: S,
) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match dt {
        Some(datetime) => serializer.serialize_some(&datetime.to_chrono().to_rfc3339()),
        None => serializer.serialize_none(),
    }
}
