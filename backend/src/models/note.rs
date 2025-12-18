//! Note (Diary) model

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use crate::utils::serializers::*;

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
