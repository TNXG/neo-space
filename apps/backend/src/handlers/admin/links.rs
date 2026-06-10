//! Admin links（owner-only 写操作 + state 计数 + health 触发）

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::*,
    tasks::link_health_check::perform_health_check,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::stream::{self, StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
        async move {
            coll.count_documents(doc! { "state": s })
                .await
                .map(|c| c as i64)
        }
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

pub async fn check_link_health(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<HashMap<String, LinkHealthStatus>>>> {
    let collection = state.db.collection::<serde_json::Value>("links");
    let filter = doc! {
        "$or": [
            { "state": LinkState::NORMAL },
            { "state": { "$exists": false } }
        ]
    };

    let mut cursor = collection
        .find(filter)
        .await
        .map_err(|error| AppError::Database(format!("Failed to query links: {error}")))?;

    let mut links = Vec::new();
    while let Some(link) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(format!("Failed to iterate links: {error}")))?
    {
        links.push(link);
    }

    let concurrency_limit = (links.len() / 2).clamp(3, 17);
    let results = stream::iter(links)
        .map(|link| {
            let http_client = state.http_client.clone();
            async move { perform_health_check(&link, &http_client).await }
        })
        .buffer_unordered(concurrency_limit)
        .collect::<Vec<_>>()
        .await;

    let mut response = HashMap::new();
    for result in results {
        let hosting_provider = serde_json::to_value(&result.hosting_provider)
            .ok()
            .and_then(|value| value.as_str().map(ToString::to_string))
            .unwrap_or_else(|| "unknown".to_string());

        let health_data = LinkHealthStatus {
            link_id: result.link_id.clone(),
            url: result.url,
            is_alive: result.is_alive,
            status_code: result.status_code,
            latency_ms: result.latency_ms,
            hosting_provider,
            checked_at: result.checked_at.to_rfc3339(),
            error_message: result.error_message,
            is_stale: false,
        };

        if let Ok(serialized) = serde_json::to_vec(&health_data) {
            let cache_key = format!("link_health_{}", health_data.link_id);
            state.link_health_cache.insert(cache_key, serialized).await;
        }

        response.insert(health_data.link_id.clone(), health_data);
    }

    Ok(Json(ApiResponse::success(response)))
}
