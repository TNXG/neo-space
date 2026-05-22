//! Admin comments 批量操作

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::*,
};
use axum::{extract::State, response::Json};
use bson::{doc, oid::ObjectId};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum BatchStatePayload {
    Specific {
        ids: Vec<String>,
        state: i32,
    },
    All {
        // Wire-format discriminator — enforces matching the `all=true` JSON shape
        // even though we don't read the value after deserialization.
        #[allow(dead_code)]
        all: bool,
        state: i32,
        #[serde(rename = "currentState")]
        current_state: i32,
    },
}

#[derive(Debug, Deserialize)]
pub struct BatchDeletePayload {
    pub ids: Vec<String>,
}

pub async fn batch_update_state(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<BatchStatePayload>,
) -> AppResult<Json<ApiResponse<u64>>> {
    let collection = state.db.collection::<Comment>("comments");
    let (filter, new_state) = match payload {
        BatchStatePayload::Specific { ids, state: s } => {
            let mut oids = Vec::with_capacity(ids.len());
            for id in &ids {
                let oid = ObjectId::parse_str(id)
                    .map_err(|_| AppError::BadRequest(format!("Invalid id: {}", id)))?;
                oids.push(oid);
            }
            (doc! { "_id": { "$in": oids } }, s)
        }
        BatchStatePayload::All {
            all: _,
            state: s,
            current_state,
        } => (doc! { "state": current_state }, s),
    };
    let result = collection
        .update_many(filter, doc! { "$set": { "state": new_state } })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(result.modified_count)))
}

pub async fn batch_delete(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(payload): AppJson<BatchDeletePayload>,
) -> AppResult<Json<ApiResponse<u64>>> {
    let mut oids = Vec::with_capacity(payload.ids.len());
    for id in &payload.ids {
        oids.push(ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid id".into()))?);
    }
    let r = state
        .db
        .collection::<Comment>("comments")
        .update_many(
            doc! { "_id": { "$in": oids } },
            doc! { "$set": { "isDeleted": true } },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(r.modified_count)))
}

pub async fn update_state(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    axum::extract::Path(id): axum::extract::Path<String>,
    AppJson(payload): AppJson<serde_json::Value>,
) -> AppResult<Json<ApiResponse<()>>> {
    let oid = ObjectId::parse_str(&id).map_err(|_| AppError::BadRequest("Invalid id".into()))?;
    let new_state = payload
        .get("state")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| AppError::BadRequest("state 必填".into()))?;
    state
        .db
        .collection::<Comment>("comments")
        .update_one(
            doc! { "_id": oid },
            doc! { "$set": { "state": new_state as i32 } },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(())))
}
