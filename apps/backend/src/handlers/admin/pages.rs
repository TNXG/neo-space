//! Admin pages CRUD（owner-only）

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::*,
    tasks::content_change::{notify_page_changed, notify_page_deleted},
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct CreatePageRequest {
    pub title: String,
    pub text: String,
    pub slug: String,
    #[serde(default)]
    pub subtitle: Option<String>,
    #[serde(default)]
    pub order: Option<i32>,
    pub meta: Option<bson::Document>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdatePageRequest {
    pub title: Option<String>,
    pub text: Option<String>,
    pub slug: Option<String>,
    pub subtitle: Option<String>,
    pub order: Option<i32>,
    pub meta: Option<bson::Document>,
}

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

/// GET /pages
pub async fn list_pages(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<Vec<Page>>>> {
    let collection = state.db.collection::<Page>("pages");
    let opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "order": 1, "created": 1 })
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
    Ok(Json(ApiResponse::success(items)))
}

/// GET /pages/{id}
pub async fn get_page_by_id(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<Page>>> {
    let oid = parse_oid(&id)?;
    let page = state
        .db
        .collection::<Page>("pages")
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Page not found".into()))?;
    Ok(Json(ApiResponse::success(page)))
}

/// POST /pages
pub async fn create_page(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreatePageRequest>,
) -> AppResult<Json<ApiResponse<Page>>> {
    if state
        .db
        .collection::<Page>("pages")
        .find_one(doc! { "slug": &req.slug })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .is_some()
    {
        return Err(AppError::BadRequest(format!(
            "Slug '{}' 已被使用",
            req.slug
        )));
    }
    let id = ObjectId::new();
    let mut doc = doc! {
        "_id": id,
        "title": &req.title,
        "text": &req.text,
        "slug": &req.slug,
        "allowComment": true,
        "created": bson::DateTime::now(),
    };
    if let Some(v) = &req.subtitle {
        doc.insert("subtitle", v);
    }
    if let Some(v) = req.order {
        doc.insert("order", v);
    }
    if let Some(meta) = req.meta {
        doc.insert("meta", meta);
    }
    state
        .db
        .collection::<bson::Document>("pages")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let inserted = state
        .db
        .collection::<Page>("pages")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Page not found after insert".into()))?;
    notify_page_changed(&state, &inserted, None).await;
    Ok(Json(ApiResponse::success(inserted)))
}

/// PUT /pages/{id}
pub async fn update_page(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdatePageRequest>,
) -> AppResult<Json<ApiResponse<Page>>> {
    let oid = parse_oid(&id)?;
    let collection = state.db.collection::<Page>("pages");
    let previous = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Page not found".into()))?;
    let mut set_doc = doc! { "modified": bson::DateTime::now() };
    if let Some(v) = req.title {
        set_doc.insert("title", v);
    }
    if let Some(v) = req.text {
        set_doc.insert("text", v);
    }
    if let Some(v) = req.slug {
        set_doc.insert("slug", v);
    }
    if let Some(v) = req.subtitle {
        set_doc.insert("subtitle", v);
    }
    if let Some(v) = req.order {
        set_doc.insert("order", v);
    }
    if let Some(meta) = req.meta {
        set_doc.insert("meta", meta);
    }
    let result = collection
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.matched_count == 0 {
        return Err(AppError::NotFound("Page not found".into()));
    }
    let updated = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Page not found".into()))?;
    notify_page_changed(&state, &updated, Some(&previous.slug)).await;
    Ok(Json(ApiResponse::success(updated)))
}

/// DELETE /pages/{id}
pub async fn delete_page(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let collection = state.db.collection::<Page>("pages");
    let page = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Page not found".into()))?;
    let result = collection
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Page not found".into()));
    }
    notify_page_deleted(&state, &page).await;
    Ok(Json(ApiResponse::success(())))
}
