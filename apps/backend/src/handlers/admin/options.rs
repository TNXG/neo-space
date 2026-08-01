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

const MANAGED_OPTION_KEYS: &[&str] = &[
    "ai",
    "bangumiOptions",
    "commentOptions",
    "friendLinkOptions",
    "mailOptions",
    "oauth",
    "searchOptions",
    "securityOptions",
    "seo",
    "url",
];

fn ensure_managed_option(key: &str) -> AppResult<()> {
    if MANAGED_OPTION_KEYS.contains(&key) {
        Ok(())
    } else {
        Err(AppError::NotFound(format!("option '{key}' is not managed")))
    }
}

fn merge_option_value(current: &mut Value, patch: Value) {
    match (current, patch) {
        (Value::Object(current), Value::Object(patch)) => {
            for (key, value) in patch {
                match current.get_mut(&key) {
                    Some(existing) => merge_option_value(existing, value),
                    None => {
                        current.insert(key, value);
                    }
                }
            }
        }
        (Value::Array(current), Value::Array(patch))
            if patch.iter().all(|value| value.get("type").is_some()) =>
        {
            for patch_item in patch {
                let item_type = patch_item.get("type").and_then(Value::as_str);
                let existing = item_type.and_then(|item_type| {
                    current
                        .iter_mut()
                        .find(|value| value.get("type").and_then(Value::as_str) == Some(item_type))
                });
                if let Some(existing) = existing {
                    merge_option_value(existing, patch_item);
                } else {
                    current.push(patch_item);
                }
            }
        }
        (current, patch) => *current = patch,
    }
}

async fn write_option(
    state: &SharedState,
    key: &str,
    value: Value,
) -> AppResult<Json<ApiResponse<Value>>> {
    let bson_val = bson::to_bson(&value).map_err(|e| AppError::Internal(format!("encode: {e}")))?;
    let collection = state.db.collection::<bson::Document>("options");
    let opts = mongodb::options::UpdateOptions::builder()
        .upsert(true)
        .build();
    collection
        .update_one(
            doc! { "name": key },
            doc! { "$set": { "name": key, "value": bson_val } },
        )
        .with_options(opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    // 环境变量是部署级最高优先级；保存后立即回写覆盖值并刷新运行时快照。
    crate::config::runtime::synchronize_environment_options(&state.db)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    state.reload_runtime_config().await;

    if matches!(
        key,
        "seo" | "url" | "friendLinkOptions" | "commentOptions" | "oauth"
    ) {
        crate::tasks::isr::trigger_isr_revalidation(state, "site-config", None).await;
    }
    if key == "bangumiOptions" {
        crate::tasks::isr::trigger_isr_revalidation(state, "bangumi", None).await;
    }

    let effective_value = collection
        .find_one(doc! { "name": key })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .and_then(|document| document.get("value").cloned())
        .map(bson::from_bson::<Value>)
        .transpose()
        .map_err(|error| AppError::Internal(format!("Bson decode: {error}")))?
        .unwrap_or(value);
    Ok(Json(ApiResponse::success(effective_value)))
}

/// GET /options
pub async fn get_all_options(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<serde_json::Map<String, Value>>>> {
    let collection = state.db.collection::<bson::Document>("options");
    let mut cursor = collection
        .find(doc! { "name": { "$in": MANAGED_OPTION_KEYS } })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;
    let mut map = serde_json::Map::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        if let Ok(name) = d.get_str("name")
            && let Some(v) = d.get("value")
        {
            let val: Value = bson::from_bson(v.clone())
                .map_err(|e| AppError::Internal(format!("Bson decode: {}", e)))?;
            map.insert(name.to_string(), val);
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
    ensure_managed_option(&key)?;
    let collection = state.db.collection::<bson::Document>("options");
    let d = collection
        .find_one(doc! { "name": &key })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound(format!("option '{}' not found", key)))?;
    let value = d
        .get("value")
        .cloned()
        .map(bson::from_bson::<Value>)
        .transpose()
        .map_err(|e| AppError::Internal(format!("Bson decode: {}", e)))?
        .unwrap_or(Value::Null);
    Ok(Json(ApiResponse::success(value)))
}

/// PATCH /options/{key} — 对对象配置执行深度合并，保留未提交字段。
pub async fn upsert_option(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(key): Path<String>,
    AppJson(req): AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    ensure_managed_option(&key)?;
    let collection = state.db.collection::<bson::Document>("options");
    let existing = collection
        .find_one(doc! { "name": &key })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .and_then(|document| document.get("value").cloned())
        .map(bson::from_bson::<Value>)
        .transpose()
        .map_err(|e| AppError::Internal(format!("Bson decode: {e}")))?;

    let mut merged = existing.unwrap_or(Value::Null);
    merge_option_value(&mut merged, req);
    write_option(&state, &key, merged).await
}

/// PUT /options/{key} — 用完整文档替换当前 value，支持明确删除字段。
pub async fn replace_option(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(key): Path<String>,
    AppJson(req): AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    ensure_managed_option(&key)?;
    write_option(&state, &key, req).await
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
            "webUrl": state.config().frontend_url,
            "serverUrl": state.config().backend_url,
        }),
    };
    Ok(Json(ApiResponse::success(value)))
}

/// PATCH /options/url — 静态兼容路由需要显式转发，否则不会匹配 /options/{key}。
pub async fn upsert_url_option(
    state: State<SharedState>,
    owner: OwnerOnly,
    payload: AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    upsert_option(state, owner, Path("url".to_string()), payload).await
}

/// PUT /options/url — 完整替换 URL 配置。
pub async fn replace_url_option(
    state: State<SharedState>,
    owner: OwnerOnly,
    payload: AppJson<Value>,
) -> AppResult<Json<ApiResponse<Value>>> {
    replace_option(state, owner, Path("url".to_string()), payload).await
}

/// POST /options/mailOptions/test — 向站长邮箱发送真实的品牌 HTML 测试邮件。
pub async fn send_test_email(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<()>>> {
    let notification_service =
        crate::services::notification::NotificationService::new(state.db.clone());
    let admin_config = notification_service.get_admin_config().await?;

    state
        .email_service
        .send_owner_email(
            &admin_config.email,
            "邮件 UI 测试",
            "如果你看到这张带有站点标识、青绿色品牌条和统一页脚的卡片，说明 HTML 邮件模板已经生效。",
            &admin_config.site_name,
        )
        .await?;

    Ok(Json(ApiResponse::success(())))
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::merge_option_value;

    #[test]
    fn merges_nested_option_objects() {
        let mut current = json!({ "smtp": { "host": "old", "port": 587 }, "enable": true });
        merge_option_value(&mut current, json!({ "smtp": { "host": "new" } }));

        assert_eq!(
            current,
            json!({ "smtp": { "host": "new", "port": 587 }, "enable": true })
        );
    }

    #[test]
    fn merges_oauth_providers_by_type() {
        let mut current = json!({
            "providers": [
                { "type": "github", "enabled": true },
                { "type": "google", "enabled": false }
            ]
        });
        merge_option_value(
            &mut current,
            json!({ "providers": [{ "type": "google", "enabled": true }] }),
        );

        assert_eq!(
            current,
            json!({
                "providers": [
                    { "type": "github", "enabled": true },
                    { "type": "google", "enabled": true }
                ]
            })
        );
    }
}
