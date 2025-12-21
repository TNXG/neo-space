//! Serialization helpers for BSON types

use bson::oid::ObjectId;
use serde::{Serializer, Deserializer, Deserialize};
use chrono::{DateTime, Utc};

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

/// Deserialize DateTime flexibly - handles both BSON DateTime and JavaScript Date formats
/// This is needed because the database may contain dates in different formats
pub fn deserialize_flexible_datetime<'de, D>(deserializer: D) -> Result<bson::DateTime, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;
    
    // Try to deserialize as BSON value first
    let value = bson::Bson::deserialize(deserializer)?;
    
    match value {
        // If it's already a BSON DateTime, use it directly
        bson::Bson::DateTime(dt) => Ok(dt),
        
        // If it's a string (ISO 8601), parse it
        bson::Bson::String(s) => {
            let chrono_dt = DateTime::parse_from_rfc3339(&s)
                .map_err(|e| Error::custom(format!("Failed to parse datetime string: {}", e)))?;
            Ok(bson::DateTime::from_chrono(chrono_dt.with_timezone(&Utc)))
        }
        
        // If it's a timestamp (milliseconds since epoch)
        bson::Bson::Int64(ts) => {
            let chrono_dt = DateTime::from_timestamp_millis(ts)
                .ok_or_else(|| Error::custom("Invalid timestamp"))?;
            Ok(bson::DateTime::from_chrono(chrono_dt))
        }
        
        // If it's a 32-bit timestamp (seconds since epoch)
        bson::Bson::Int32(ts) => {
            let chrono_dt = DateTime::from_timestamp(ts as i64, 0)
                .ok_or_else(|| Error::custom("Invalid timestamp"))?;
            Ok(bson::DateTime::from_chrono(chrono_dt))
        }
        
        _ => Err(Error::custom(format!("Unexpected BSON type for datetime: {:?}", value))),
    }
}
