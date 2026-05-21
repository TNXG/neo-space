//! Admin links（owner-only 写操作 + state 计数 + health 触发）

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
use serde::{Deserialize, Serialize};

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

#[derive(Debug, Deserialize)]
pub struct CreateLinkRequest {
    pub name: String,
    pub url: String,
    pub avatar: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type", default)]
    pub link_type: Option<i32>,
    #[serde(default)]
    pub state: Option<i32>,
}

#[derive(Debug, Deserialize, Default)]
pub struct UpdateLinkRequest {
    pub name: Option<String>,
    pub url: Option<String>,
    pub avatar: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub link_type: Option<i32>,
    pub state: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct LinkStateCount {
    pub audit: i64,
    pub pass: i64,
    pub outdate: i64,
    pub banned: i64,
}

pub async fn create_link(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(req): AppJson<CreateLinkRequest>,
) -> AppResult<Json<ApiResponse<Link>>> {
    let id = ObjectId::new();
    let doc = doc! {
        "_id": id,
        "name": &req.name,
        "url": &req.url,
        "avatar": req.avatar,
        "description": req.description.unwrap_or_default(),
        "type": req.link_type.unwrap_or(0),
        "state": req.state.unwrap_or(0),
        "created": bson::DateTime::now(),
    };
    state
        .db
        .collection::<bson::Document>("links")
        .insert_one(doc)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let link = state
        .db
        .collection::<Link>("links")
        .find_one(doc! { "_id": id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal("Link not found after insert".into()))?;
    Ok(Json(ApiResponse::success(link)))
}

pub async fn update_link(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
    AppJson(req): AppJson<UpdateLinkRequest>,
) -> AppResult<Json<ApiResponse<Link>>> {
    let oid = parse_oid(&id)?;
    let mut set_doc = doc! {};
    if let Some(v) = req.name {
        set_doc.insert("name", v);
    }
    if let Some(v) = req.url {
        set_doc.insert("url", v);
    }
    if let Some(v) = req.avatar {
        set_doc.insert("avatar", v);
    }
    if let Some(v) = req.description {
        set_doc.insert("description", v);
    }
    if let Some(v) = req.link_type {
        set_doc.insert("type", v);
    }
    if let Some(v) = req.state {
        set_doc.insert("state", v);
    }
    state
        .db
        .collection::<Link>("links")
        .update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let link = state
        .db
        .collection::<Link>("links")
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Link not found".into()))?;
    Ok(Json(ApiResponse::success(link)))
}

pub async fn delete_link(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = parse_oid(&id)?;
    let r = state
        .db
        .collection::<Link>("links")
        .delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    if r.deleted_count == 0 {
        return Err(AppError::NotFound("Link not found".into()));
    }
    Ok(Json(ApiResponse::success(())))
}

pub async fn link_state_count(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<LinkStateCount>>> {
    let collection = state.db.collection::<Link>("links");
    let count = |s: i32| {
        let coll = collection.clone();
        async move { coll.count_documents(doc! { "state": s }).await.map(|c| c as i64) }
    };
    let audit = count(0).await.unwrap_or(0);
    let pass = count(1).await.unwrap_or(0);
    let outdate = count(2).await.unwrap_or(0);
    let banned = count(3).await.unwrap_or(0);
    Ok(Json(ApiResponse::success(LinkStateCount {
        audit,
        pass,
        outdate,
        banned,
    })))
}
