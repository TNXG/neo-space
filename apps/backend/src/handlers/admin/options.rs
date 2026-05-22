//! Admin options（系统配置 KV）

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
use bson::doc;
use futures::TryStreamExt;
use serde_json::Value;

/// GET /options
pub async fn get_all_options(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<serde_json::Map<String, Value>>>> {
    let collection = state.db.collection::<bson::Document>("options");
    let mut cursor = collection
        .find(doc! {})
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut map = serde_json::Map::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        if let Ok(name) = d.get_str("name") {
            if let Some(v) = d.get("value") {
                let val: Value = bson::from_bson(v.clone())
                    .map_err(|e| AppError::Internal(format!("Bson decode: {}", e)))?;
                map.insert(name.to_string(), val);
            }
        }
    }
    Ok(Json(ApiResponse::success(map)))
}

/// GET /options/{key}
pub async fn get_option(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(key): Path<String>,
) -> AppResult<Json<ApiResponse<Value>>> {
    let collection = state.db.collection::<bson::Document>("options");
    let d = collection
        .find_one(doc! { "name": &key })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound(format!("option '{}' not found", key)))?;
    let value = d
        .get("value")
        .cloned()
        .map(|v| bson::from_bson::<Value>(v))
        .transpose()
        .map_err(|e| AppError::Internal(format!("Bson decode: {}", e)))?
        .unwrap_or(Value::Null);
    Ok(Json(ApiResponse::success(value)))
}

/// PATCH /options/{key} — upsert 单 key
pub async fn upsert_option(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(key): Path<String>,
    AppJson(req): AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    let bson_val = bson::to_bson(&req).map_err(|e| AppError::Internal(format!("encode: {}", e)))?;
    let collection = state.db.collection::<bson::Document>("options");
    let opts = mongodb::options::UpdateOptions::builder()
        .upsert(true)
        .build();
    collection
        .update_one(
            doc! { "name": &key },
            doc! { "$set": { "name": &key, "value": &bson_val } },
        )
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    Ok(Json(ApiResponse::success(req)))
}

/// GET /options/url — 兼容 mx-admin 调用
pub async fn get_url_options(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Value>>> {
    let collection = state.db.collection::<bson::Document>("options");
    let d = collection
        .find_one(doc! { "name": "url" })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let value = match d.and_then(|d| d.get("value").cloned()) {
        Some(v) => {
            bson::from_bson::<Value>(v).map_err(|e| AppError::Internal(format!("decode: {}", e)))?
        }
        None => serde_json::json!({
            "webUrl": state.config.frontend_url,
            "adminUrl": "",
            "serverUrl": state.config.backend_url,
            "wsUrl": "",
        }),
    };
    Ok(Json(ApiResponse::success(value)))
}
