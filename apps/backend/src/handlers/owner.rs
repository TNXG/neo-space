//! Owner-side public endpoints used by the admin dashboard
//!
//! 这些端点不需要鉴权——admin 在登录前用它判断当前部署支持哪些登录方式。
//! 返回值必须和真实登录链路一致，避免前端隐藏后端实际可用的登录入口。

use crate::{
    app::SharedState,
    error::{AppError, AppQuery, AppResult},
    handlers::auth::find_owner_reader,
    models::options::RawOption,
    models::*,
};
use axum::{Json, extract::State};
use bson::{Bson, Document, doc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct IdentifyOwnerQuery {
    pub identifier: String,
}

#[derive(Debug, Serialize)]
pub struct OwnerLoginProfile {
    pub name: String,
    pub username: String,
    pub avatar: String,
}

#[derive(Debug, Serialize)]
pub struct IdentifyOwnerResponse {
    pub matched: bool,
    pub profile: Option<OwnerLoginProfile>,
}

/// `GET /api/owner/allow-login`
///
/// 返回当前后端实际支持的登录方式。字段含义：
///
/// - `password`: `accounts` 集合中存在 credential/password provider 的记录。
/// - `passkey`: Owner 已在 `passkeys` 集合注册至少一个凭据。
/// - `github`: 来自 `AppConfig` 或 `options.oauth` 的真实配置。
/// - `qq`: QQ 中转登录是否启用。
/// - `passkeyAutomatic`: 是否在登录页启用 Passkey 条件式自动填充。
pub async fn allow_login(State(state): State<SharedState>) -> AppResult<Json<ApiResponse<Value>>> {
    let accounts = state.db.collection::<Document>("accounts");

    let password = accounts
        .count_documents(doc! {
            "$or": [
                { "providerId": "credential" },
                { "provider": "credential" },
                { "provider": "password" }
            ],
            "password": { "$type": "string" }
        })
        .await
        .map_err(|e| AppError::Database(format!("count credential failed: {e}")))?
        > 0;

    let passkey = state
        .db
        .collection::<Document>("passkeys")
        .count_documents(doc! {})
        .await
        .map_err(|e| AppError::Database(format!("count passkey failed: {e}")))?
        > 0
        && state.passkey_service().is_some();

    // GitHub 必须有真实 client id；QQ 始终使用中转服务。
    let mut github = !state.config().github_client_id.trim().is_empty();
    let mut qq = true;
    let mut passkey_automatic = false;
    let oauth_doc = state
        .db
        .collection::<RawOption>("options")
        .find_one(doc! { "name": "oauth" })
        .await
        .map_err(|e| AppError::Database(format!("load oauth options failed: {e}")))?;

    if let Some(option) = oauth_doc
        && let Bson::Document(d) = option.value
    {
        if !github {
            github = first_non_empty_str(
                &d,
                &[
                    &["github", "clientId"],
                    &["public", "github", "clientId"],
                    &["github", "client_id"],
                ],
            )
            .is_some();
        }
        github &= provider_enabled(&d, "github").unwrap_or(true);
        qq &= provider_enabled(&d, "qq").unwrap_or(true);
        passkey_automatic = d.get_bool("passkeyAutomatic").unwrap_or(false);
    }

    let body = serde_json::json!({
        "password": password,
        "passkey": passkey,
        "passkeyAutomatic": passkey_automatic,
        "github": github,
        "qq": qq,
    });

    Ok(Json(ApiResponse::success(body)))
}

/// 校验输入是否属于 Owner，仅在匹配后返回用于登录页展示的公开资料。
pub async fn identify_owner(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<IdentifyOwnerQuery>,
) -> AppResult<Json<ApiResponse<IdentifyOwnerResponse>>> {
    let identifier = query.identifier.trim();
    if identifier.is_empty() {
        return Ok(Json(ApiResponse::success(IdentifyOwnerResponse {
            matched: false,
            profile: None,
        })));
    }

    match find_owner_reader(&state, identifier).await {
        Ok(reader) => Ok(Json(ApiResponse::success(IdentifyOwnerResponse {
            matched: true,
            profile: Some(OwnerLoginProfile {
                name: reader.name,
                username: reader.handle,
                avatar: reader.image,
            }),
        }))),
        Err(AppError::Unauthorized) => Ok(Json(ApiResponse::success(IdentifyOwnerResponse {
            matched: false,
            profile: None,
        }))),
        Err(error) => Err(error),
    }
}

/// 读取 OAuth providers 数组中的显式启用状态。
fn provider_enabled(document: &Document, provider_type: &str) -> Option<bool> {
    document
        .get_array("providers")
        .ok()?
        .iter()
        .find_map(|provider| {
            let provider = provider.as_document()?;
            (provider.get_str("type").ok()? == provider_type)
                .then(|| provider.get_bool("enabled").unwrap_or(false))
        })
}

fn first_non_empty_str(document: &Document, paths: &[&[&str]]) -> Option<String> {
    paths.iter().find_map(|path| {
        find_string(document, path).and_then(|s| {
            let trimmed = s.trim();
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        })
    })
}

fn find_string<'a>(document: &'a Document, path: &[&str]) -> Option<&'a str> {
    let (head, rest) = path.split_first()?;
    let value = document.get(*head)?;
    if rest.is_empty() {
        return value.as_str();
    }
    match value {
        Bson::Document(nested) => find_string(nested, rest),
        _ => None,
    }
}
