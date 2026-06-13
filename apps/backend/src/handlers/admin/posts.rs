//! Admin posts CRUD（owner-only）
//!
//! 提供 mx-admin 文章管理面板所需的写操作：创建、更新、删除、批量删除。
//! 公共读取仍走 handlers/post/list.rs 与 handlers/post/detail.rs。

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
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub title: String,
    pub text: String,
    #[serde(rename = "categoryId")]
    pub category_id: String,
    pub slug: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub summary: Option<String>,
    #[serde(default)]
    pub copyright: bool,
    #[serde(rename = "isPublished", default = "default_true")]
    pub is_published: bool,
    #[serde(rename = "contentFormat", default)]
    pub content_format: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub pin: Option<Value>,
    #[serde(rename = "pinOrder", default)]
    pub pin_order: Option<i32>,
    pub meta: Option<bson::Document>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdatePostRequest {
    pub title: Option<String>,
    pub text: Option<String>,
    #[serde(rename = "categoryId")]
    pub category_id: Option<String>,
    pub slug: Option<String>,
    pub tags: Option<Vec<String>>,
    pub summary: Option<String>,
    pub copyright: Option<bool>,
    #[serde(rename = "isPublished")]
    pub is_published: Option<bool>,
    #[serde(rename = "contentFormat")]
    pub content_format: Option<String>,
    pub content: Option<String>,
    #[serde(default)]
    pub pin: Option<Value>,
    #[serde(rename = "pinOrder")]
    pub pin_order: Option<i32>,
    pub meta: Option<bson::Document>,
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

fn now() -> bson::DateTime {
    bson::DateTime::now()
}

fn parse_pin_at(pin: &Value) -> AppResult<Option<bson::DateTime>> {
    match pin {
        Value::String(value) if !value.trim().is_empty() => {
            let parsed = chrono::DateTime::parse_from_rfc3339(value)
                .map_err(|_| AppError::BadRequest("Invalid pin timestamp".to_string()))?;
            Ok(Some(bson::DateTime::from_millis(parsed.timestamp_millis())))
        }
        _ => Ok(None),
    }
}

fn slugify(input: &str) -> String {
    let lower = input.to_lowercase();
    let mut out = String::with_capacity(lower.len());
    let mut prev_dash = false;
    for ch in lower.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    if out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        format!("post-{}", chrono::Utc::now().timestamp())
    } else {
        out
    }
}

/// POST /posts
pub async fn create_post(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreatePostRequest>,
) -> AppResult<Json<ApiResponse<Post>>> {
    let category_id = parse_oid(&req.category_id)?;
    let slug = req.slug.unwrap_or_else(|| slugify(&req.title));

    let collection = state.db.collection::<Post>("posts");

    // 检查 slug 唯一性
    if let Some(_existing) = collection
        .find_one(doc! { "slug": &slug })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        return Err(AppError::BadRequest(format!("Slug '{}' 已被使用", slug)));
    }

    let id = ObjectId::new();
    let mut doc = doc! {
        "_id": id,
        "title": &req.title,
        "text": &req.text,
        "slug": &slug,
        "categoryId": category_id,
        "tags": &req.tags,
        "copyright": req.copyright,
        "isPublished": req.is_published,
        "allowComment": true,
        "lang": "zh",
        "sourceLang": "zh",
        "isAiTranslated": false,
        "created": now(),
    };
    if let Some(content_format) = &req.content_format {
        doc.insert("contentFormat", content_format);
    }
    if let Some(content) = &req.content {
        doc.insert("content", content);
    }
    if let Some(pin) = &req.pin
        && let Some(pin_at) = parse_pin_at(pin)?
    {
        doc.insert("pinAt", pin_at);
        if let Some(pin_order) = req.pin_order {
            doc.insert("pinOrder", pin_order);
        }
    }
    if let Some(s) = &req.summary {
        doc.insert("summary", s);
    }
    if let Some(meta) = &req.meta {
        doc.insert("meta", meta);
    }

    state
        .db
        .collection::<bson::Document>("posts")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let inserted = collection
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Post not found after insert".into()))?;

    Ok(Json(ApiResponse::success(inserted)))
}

/// PUT /posts/{id}
pub async fn update_post(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdatePostRequest>,
) -> AppResult<Json<ApiResponse<Post>>> {
    let oid = parse_oid(&id)?;

    let mut set_doc = doc! { "modified": now() };
    if let Some(v) = req.title {
        set_doc.insert("title", v);
    }
    if let Some(v) = req.text {
        set_doc.insert("text", v);
    }
    if let Some(v) = req.slug {
        set_doc.insert("slug", v);
    }
    if let Some(v) = req.category_id {
        set_doc.insert("categoryId", parse_oid(&v)?);
    }
    if let Some(v) = req.tags {
        set_doc.insert("tags", v);
    }
    if let Some(v) = req.summary {
        set_doc.insert("summary", v);
    }
    if let Some(v) = req.copyright {
        set_doc.insert("copyright", v);
    }
    if let Some(v) = req.is_published {
        set_doc.insert("isPublished", v);
    }
    if let Some(v) = req.content_format {
        set_doc.insert("contentFormat", v);
    }
    if let Some(v) = req.content {
        set_doc.insert("content", v);
    }
    if let Some(v) = req.pin_order {
        set_doc.insert("pinOrder", v);
    }
    if let Some(meta) = req.meta {
        set_doc.insert("meta", meta);
    }

    if let Some(pin) = &req.pin
        && let Some(pin_at) = parse_pin_at(pin)?
    {
        set_doc.insert("pinAt", pin_at);
    }
    let update_doc = doc! { "$set": set_doc };

    let collection = state.db.collection::<Post>("posts");
    let result = collection
        .update_one(doc! { "_id": oid }, update_doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    if result.matched_count == 0 {
        return Err(AppError::NotFound("Post not found".into()));
    }

    let updated = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Post not found".into()))?;

    Ok(Json(ApiResponse::success(updated)))
}

/// DELETE /posts/{id}
pub async fn delete_post(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let collection = state.db.collection::<Post>("posts");
    let result = collection
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Post not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

/// DELETE /posts/batch
pub async fn delete_posts_batch(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<BatchIdsRequest>,
) -> AppResult<Json<ApiResponse<u64>>> {
    let mut oids = Vec::with_capacity(req.ids.len());
    for id in &req.ids {
        oids.push(parse_oid(id)?);
    }
    let collection = state.db.collection::<Post>("posts");
    let result = collection
        .delete_many(doc! { "_id": { "$in": oids } })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(result.deleted_count)))
}
