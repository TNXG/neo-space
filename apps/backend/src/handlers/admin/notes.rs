//! Admin notes CRUD（owner-only）
//!
//! 公共读取走 handlers/note.rs。这里负责管理写操作。

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub title: String,
    pub text: String,
    #[allow(dead_code)]
    pub slug: Option<String>,
    #[serde(default)]
    pub mood: Option<String>,
    #[serde(default)]
    pub weather: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub bookmark: bool,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(rename = "topicId", default)]
    pub topic_id: Option<String>,
    #[serde(rename = "isPublished", default = "default_true")]
    pub is_published: bool,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub text: Option<String>,
    pub mood: Option<String>,
    pub weather: Option<String>,
    pub password: Option<String>,
    pub bookmark: Option<bool>,
    pub location: Option<String>,
    #[serde(rename = "isPublished")]
    pub is_published: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct BatchIdsRequest {
    pub ids: Vec<String>,
}

fn default_true() -> bool {
    true
}

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

async fn next_nid(state: &SharedState) -> AppResult<i32> {
    let collection = state.db.collection::<bson::Document>("notes");
    let opts = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "nid": -1 })
        .projection(doc! { "nid": 1 })
        .build();
    let last = collection
        .find_one(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(last
        .and_then(|d| d.get_i32("nid").ok())
        .map(|n| n + 1)
        .unwrap_or(1))
}

/// POST /notes
pub async fn create_note(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateNoteRequest>,
) -> AppResult<Json<ApiResponse<Note>>> {
    let nid = next_nid(&state).await?;
    let id = ObjectId::new();
    let mut doc = doc! {
        "_id": id,
        "nid": nid,
        "title": &req.title,
        "text": &req.text,
        "isPublished": req.is_published,
        "bookmark": req.bookmark,
        "allowComment": true,
        "isEncrypted": req.password.as_deref().map(|p| !p.is_empty()).unwrap_or(false),
        "lang": "zh",
        "sourceLang": "zh",
        "isAiTranslated": false,
        "created": bson::DateTime::now(),
    };
    if let Some(v) = &req.mood {
        doc.insert("mood", v);
    }
    if let Some(v) = &req.weather {
        doc.insert("weather", v);
    }
    if let Some(v) = &req.location {
        doc.insert("location", v);
    }
    if let Some(p) = &req.password {
        if !p.is_empty() {
            doc.insert("password", p);
        }
    }
    if let Some(t) = &req.topic_id {
        doc.insert("topicId", parse_oid(t)?);
    }

    state
        .db
        .collection::<bson::Document>("notes")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let inserted = state
        .db
        .collection::<Note>("notes")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Note not found after insert".into()))?;

    Ok(Json(ApiResponse::success(inserted)))
}

/// PUT /notes/{id}
pub async fn update_note(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdateNoteRequest>,
) -> AppResult<Json<ApiResponse<Note>>> {
    let oid = parse_oid(&id)?;

    let mut set_doc = doc! { "modified": bson::DateTime::now() };
    if let Some(v) = req.title {
        set_doc.insert("title", v);
    }
    if let Some(v) = req.text {
        set_doc.insert("text", v);
    }
    if let Some(v) = req.mood {
        set_doc.insert("mood", v);
    }
    if let Some(v) = req.weather {
        set_doc.insert("weather", v);
    }
    if let Some(v) = req.location {
        set_doc.insert("location", v);
    }
    if let Some(p) = req.password {
        if p.is_empty() {
            set_doc.insert("password", bson::Bson::Null);
            set_doc.insert("isEncrypted", false);
        } else {
            set_doc.insert("password", p);
            set_doc.insert("isEncrypted", true);
        }
    }
    if let Some(v) = req.bookmark {
        set_doc.insert("bookmark", v);
    }
    if let Some(v) = req.is_published {
        set_doc.insert("isPublished", v);
    }

    let collection = state.db.collection::<Note>("notes");
    let result = collection
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    if result.matched_count == 0 {
        return Err(AppError::NotFound("Note not found".into()));
    }

    let updated = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Note not found".into()))?;
    Ok(Json(ApiResponse::success(updated)))
}

/// DELETE /notes/{id}
pub async fn delete_note(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let collection = state.db.collection::<Note>("notes");
    let result = collection
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Note not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

/// DELETE /notes/batch
pub async fn delete_notes_batch(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<BatchIdsRequest>,
) -> AppResult<Json<ApiResponse<u64>>> {
    let mut oids = Vec::with_capacity(req.ids.len());
    for id in &req.ids {
        oids.push(parse_oid(id)?);
    }
    let result = state
        .db
        .collection::<Note>("notes")
        .delete_many(doc! { "_id": { "$in": oids } })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(result.deleted_count)))
}

/// GET /notes/admin/all（owner-only，含未发布）
pub async fn list_notes_admin(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<Note>>>> {
    let collection = state.db.collection::<Note>("notes");
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    let mut cursor = collection
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(n) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(n);
    }
    Ok(Json(ApiResponse::success(items)))
}
