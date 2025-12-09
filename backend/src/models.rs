use serde::{Deserialize, Serialize, Serializer};
use bson::oid::ObjectId;

// ============================================================================
// Serialization Helpers
// ============================================================================

/// Serialize ObjectId as a string
fn serialize_object_id<S>(oid: &ObjectId, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&oid.to_hex())
}

/// Serialize Option<ObjectId> as an optional string
fn serialize_optional_object_id<S>(oid: &Option<ObjectId>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match oid {
        Some(id) => serializer.serialize_some(&id.to_hex()),
        None => serializer.serialize_none(),
    }
}

/// Serialize bson::DateTime as ISO 8601 string
fn serialize_datetime<S>(dt: &bson::DateTime, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&dt.to_chrono().to_rfc3339())
}

/// Serialize Option<bson::DateTime> as optional ISO 8601 string
fn serialize_optional_datetime<S>(dt: &Option<bson::DateTime>, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    match dt {
        Some(datetime) => serializer.serialize_some(&datetime.to_chrono().to_rfc3339()),
        None => serializer.serialize_none(),
    }
}

// ============================================================================
// Standardized API Response Structures
// ============================================================================

/// Standard API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub code: u16,
    pub status: ResponseStatus,
    pub message: String,
    pub data: T,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResponseStatus {
    Success,
    Failed,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            code: 200,
            status: ResponseStatus::Success,
            message: "Success".to_string(),
            data,
        }
    }

    pub fn error(code: u16, message: String) -> ApiResponse<()> {
        ApiResponse {
            code,
            status: ResponseStatus::Failed,
            message,
            data: (),
        }
    }
}

/// Pagination metadata
#[derive(Debug, Serialize, Deserialize)]
pub struct Pagination {
    pub total: i64,
    pub current_page: i64,
    pub total_page: i64,
    pub size: i64,
    pub has_next_page: bool,
    pub has_prev_page: bool,
}

/// Paginated response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedData<T> {
    pub items: Vec<T>,
    pub pagination: Pagination,
}

pub type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;

// ============================================================================
// MongoDB Data Models
// ============================================================================

/// Post (Article) model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Post {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(rename = "categoryId", serialize_with = "serialize_object_id")]
    pub category_id: ObjectId,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    pub modified: Option<bson::DateTime>,
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    #[serde(default)]
    pub copyright: bool,
    #[serde(default)]
    pub meta: Option<String>,
    #[serde(default)]
    pub images: Vec<PostImage>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostImage {
    pub src: String,
    pub height: Option<i32>,
    pub width: Option<i32>,
    #[serde(rename = "type")]
    pub image_type: Option<String>,
}

/// Note (Diary) model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    pub nid: i32,
    pub title: String,
    pub text: String,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
    #[serde(default, serialize_with = "serialize_optional_datetime")]
    pub modified: Option<bson::DateTime>,
    #[serde(default)]
    pub mood: Option<String>,
    #[serde(default)]
    pub weather: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(rename = "allowComment", default)]
    pub allow_comment: bool,
    #[serde(rename = "isPublished", default)]
    pub is_published: bool,
    #[serde(default)]
    pub bookmark: bool,
    #[serde(default)]
    pub images: Vec<NoteImage>,
    #[serde(rename = "commentsIndex", default)]
    pub comments_index: i32,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(rename = "publicAt", default, serialize_with = "serialize_optional_datetime")]
    pub public_at: Option<bson::DateTime>,
    #[serde(default)]
    pub coordinates: Option<String>,
    #[serde(default)]
    pub count: Option<NoteCount>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteImage {
    #[serde(default)]
    pub src: Option<String>,
    pub height: Option<i32>,
    pub width: Option<i32>,
    #[serde(rename = "type")]
    pub image_type: Option<String>,
    #[serde(default)]
    pub accent: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteCount {
    pub read: i32,
    pub like: i32,
}

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

/// Activity model
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Activity {
    #[serde(rename = "_id", serialize_with = "serialize_object_id")]
    pub id: ObjectId,
    #[serde(rename = "type")]
    pub activity_type: i32,
    pub payload: String,
    #[serde(serialize_with = "serialize_datetime")]
    pub created: bson::DateTime,
}

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
