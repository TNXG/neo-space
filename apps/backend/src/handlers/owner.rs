//! Owner-side public endpoints used by the admin dashboard
//!
//! 这些端点不需要鉴权——admin 在登录前用它判断当前部署支持哪些登录方式。
//! 返回值必须和真实登录链路一致，避免前端隐藏后端实际可用的登录入口。

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    models::options::RawOption,
    models::*,
};
use axum::{Json, extract::State};
use bson::{Bson, Document, doc};
use serde_json::Value;

/// `GET /api/owner/allow-login`
///
/// 返回当前后端实际支持的登录方式。字段含义：
///
/// - `password`: `accounts` 集合中存在 credential/password provider 的记录。
/// - `passkey`: `accounts` 集合中存在 `providerId == "passkey"` 或 `provider == "passkey"`
///   的记录（暂未启用 WebAuthn，所以现网应当返回 false）。
/// - `github`: 来自 `AppConfig` 或 `options.oauth` 的真实配置。
/// - `qq`: 本地配置可用时直连 QQ；未配置时 OAuth service 会回退到 QQ 中转登录。
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

    let passkey = accounts
        .count_documents(doc! {
            "$or": [
                { "providerId": "passkey" },
                { "provider": "passkey" }
            ]
        })
        .await
        .map_err(|e| AppError::Database(format!("count passkey failed: {e}")))?
        > 0;

    // OAuth: GitHub 必须有真实 client id；QQ handler 在无本地凭据时会使用旧中转服务。
    let mut github = !state.config.github_client_id.trim().is_empty();
    let qq = true;

    if !github {
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
        }
    }

    let body = serde_json::json!({
        "password": password,
        "passkey": passkey,
        "github": github,
        "qq": qq,
    });

    Ok(Json(ApiResponse::success(body)))
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
