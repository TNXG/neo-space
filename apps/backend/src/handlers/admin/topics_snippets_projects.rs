//! Admin topics / snippets / projects CRUD（owner-only）

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::Deserialize;

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

#[derive(Debug, Deserialize)]
pub struct PageQuery {
    pub page: Option<u64>,
    pub size: Option<u64>,
}

// ==================== Topic ====================

#[derive(Debug, Deserialize)]
pub struct UpsertTopicRequest {
    pub name: Option<String>,
    pub slug: Option<String>,
    pub introduce: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
}

pub async fn list_topics(
    State(state): State<SharedState>,
    AppQuery(q): AppQuery<PageQuery>,
) -> AppResult<Json<ApiResponse<PaginatedData<Topic>>>> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 100);
    let collection = state.db.collection::<Topic>("topics");
    let total = collection
        .count_documents(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip((page - 1) * size)
        .limit(size as i64)
        .build();
    let mut cursor = collection
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(t) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(t);
    }
    let pagination = Pagination::new(total as i64, page as i64, size as i64);
    Ok(Json(ApiResponse::success(PaginatedData { items, pagination })))
}

pub async fn get_topic(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<Topic>>> {
    let oid = parse_oid(&id)?;
    let t = state
        .db
        .collection::<Topic>("topics")
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Topic not found".into()))?;
    Ok(Json(ApiResponse::success(t)))
}

pub async fn create_topic(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<UpsertTopicRequest>,
) -> AppResult<Json<ApiResponse<Topic>>> {
    let name = req.name.ok_or_else(|| AppError::BadRequest("name 必填".into()))?;
    let slug = req.slug.ok_or_else(|| AppError::BadRequest("slug 必填".into()))?;
    let introduce = req
        .introduce
        .ok_or_else(|| AppError::BadRequest("introduce 必填".into()))?;
    let id = ObjectId::new();
    let mut doc = doc! {
        "_id": id,
        "name": name,
        "slug": slug,
        "introduce": introduce,
        "created": bson::DateTime::now(),
    };
    if let Some(v) = req.description {
        doc.insert("description", v);
    }
    if let Some(v) = req.icon {
        doc.insert("icon", v);
    }
    state
        .db
        .collection::<bson::Document>("topics")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let t = state
        .db
        .collection::<Topic>("topics")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Topic not found after insert".into()))?;
    Ok(Json(ApiResponse::success(t)))
}

pub async fn update_topic(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpsertTopicRequest>,
) -> AppResult<Json<ApiResponse<Topic>>> {
    let oid = parse_oid(&id)?;
    let mut set_doc = doc! {};
    if let Some(v) = req.name {
        set_doc.insert("name", v);
    }
    if let Some(v) = req.slug {
        set_doc.insert("slug", v);
    }
    if let Some(v) = req.introduce {
        set_doc.insert("introduce", v);
    }
    if let Some(v) = req.description {
        set_doc.insert("description", v);
    }
    if let Some(v) = req.icon {
        set_doc.insert("icon", v);
    }
    state
        .db
        .collection::<Topic>("topics")
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let t = state
        .db
        .collection::<Topic>("topics")
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Topic not found".into()))?;
    Ok(Json(ApiResponse::success(t)))
}

pub async fn delete_topic(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let result = state
        .db
        .collection::<Topic>("topics")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Topic not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

// ==================== Snippet ====================

#[derive(Debug, Deserialize)]
pub struct UpsertSnippetRequest {
    pub name: Option<String>,
    pub reference: Option<String>,
    #[serde(rename = "type")]
    pub snippet_type: Option<String>,
    pub raw: Option<String>,
    pub method: Option<String>,
    #[serde(rename = "isPublic")]
    pub is_public: Option<bool>,
    #[serde(rename = "isPrivate")]
    pub is_private: Option<bool>,
    pub comment: Option<String>,
}

pub async fn list_snippets(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<Vec<Snippet>>>> {
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    let mut cursor = state
        .db
        .collection::<Snippet>("snippets")
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(s) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(s);
    }
    Ok(Json(ApiResponse::success(items)))
}

pub async fn create_snippet(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<UpsertSnippetRequest>,
) -> AppResult<Json<ApiResponse<Snippet>>> {
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "name": req.name.unwrap_or_default(),
        "reference": req.reference.unwrap_or_else(|| "root".into()),
        "type": req.snippet_type.unwrap_or_else(|| "text".into()),
        "raw": req.raw.unwrap_or_default(),
        "method": req.method,
        "isPublic": req.is_public.unwrap_or(false),
        "isPrivate": req.is_private.unwrap_or(false),
        "comment": req.comment,
        "created": bson::DateTime::now(),
    };
    state
        .db
        .collection::<bson::Document>("snippets")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let s = state
        .db
        .collection::<Snippet>("snippets")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Snippet not found after insert".into()))?;
    Ok(Json(ApiResponse::success(s)))
}

pub async fn delete_snippet(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let r = state
        .db
        .collection::<Snippet>("snippets")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if r.deleted_count == 0 {
        return Err(AppError::NotFound("Snippet not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

// ==================== Project ====================

#[derive(Debug, Deserialize)]
pub struct UpsertProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub text: Option<String>,
    #[serde(rename = "previewUrl")]
    pub preview_url: Option<String>,
    #[serde(rename = "docUrl")]
    pub doc_url: Option<String>,
    #[serde(rename = "projectUrl")]
    pub project_url: Option<String>,
    pub images: Option<Vec<String>>,
    pub avatar: Option<String>,
}

pub async fn list_projects(
    State(state): State<SharedState>,
    AppQuery(q): AppQuery<PageQuery>,
) -> AppResult<Json<ApiResponse<PaginatedData<Project>>>> {
    let page = q.page.unwrap_or(1).max(1);
    let size = q.size.unwrap_or(20).clamp(1, 100);
    let collection = state.db.collection::<Project>("projects");
    let total = collection
        .count_documents(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip((page - 1) * size)
        .limit(size as i64)
        .build();
    let mut cursor = collection
        .find(doc! {})
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut items = Vec::new();
    while let Some(p) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(p);
    }
    let pagination = Pagination::new(total as i64, page as i64, size as i64);
    Ok(Json(ApiResponse::success(PaginatedData { items, pagination })))
}

pub async fn create_project(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<UpsertProjectRequest>,
) -> AppResult<Json<ApiResponse<Project>>> {
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "name": req.name.unwrap_or_default(),
        "description": req.description.unwrap_or_default(),
        "text": req.text.unwrap_or_default(),
        "previewUrl": req.preview_url,
        "docUrl": req.doc_url,
        "projectUrl": req.project_url,
        "images": req.images.unwrap_or_default(),
        "avatar": req.avatar,
        "created": bson::DateTime::now(),
    };
    state
        .db
        .collection::<bson::Document>("projects")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let p = state
        .db
        .collection::<Project>("projects")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Project not found after insert".into()))?;
    Ok(Json(ApiResponse::success(p)))
}

pub async fn delete_project(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let r = state
        .db
        .collection::<Project>("projects")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if r.deleted_count == 0 {
        return Err(AppError::NotFound("Project not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}
