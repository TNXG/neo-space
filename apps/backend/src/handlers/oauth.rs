//! OAuth authentication handlers

use crate::services::helpers::make_runtime_oauth_service;
use crate::{
    app::SharedState,
    auth::{extractors::OptionalAuth, jwt::generate_jwt},
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{Json, extract::State, response::Redirect};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};

/// GitHub OAuth authorization
pub async fn github_oauth(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<OAuthAuthorizeQuery>,
) -> AppResult<Redirect> {
    let oauth_service = make_runtime_oauth_service(&state).await?;
    let state_token = encode_oauth_state(&query.return_to.unwrap_or_default());
    let url = oauth_service.github_authorize_url(&state_token)?;

    Ok(Redirect::to(&url))
}

/// GitHub OAuth callback
pub async fn github_callback(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<OAuthCallbackQuery>,
) -> Redirect {
    handle_oauth_callback(
        &state,
        OAuthProvider::GitHub,
        &query.code,
        query.state.as_deref(),
    )
    .await
}

/// QQ OAuth authorization
pub async fn qq_oauth(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<OAuthAuthorizeQuery>,
) -> AppResult<Redirect> {
    let oauth_service = make_runtime_oauth_service(&state).await?;
    let state_token = encode_oauth_state(&query.return_to.unwrap_or_default());
    let url = oauth_service.qq_authorize_url(&state_token)?;

    Ok(Redirect::to(&url))
}

/// QQ OAuth callback
pub async fn qq_callback(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<OAuthCallbackQuery>,
) -> Redirect {
    handle_oauth_callback(
        &state,
        OAuthProvider::QQ,
        &query.code,
        query.state.as_deref(),
    )
    .await
}

/// Get bindable OAuth identities for anonymous user
pub async fn get_bindable_identities(
    State(state): State<SharedState>,
) -> AppResult<Json<Vec<BindableIdentity>>> {
    let oauth_service = make_runtime_oauth_service(&state).await?;

    let github_client_id = oauth_service.github_client_id();

    let mut identities = vec![];

    // Add GitHub identity if configured
    if !github_client_id.is_empty() {
        identities.push(BindableIdentity {
            provider: "github".to_string(),
            name: "GitHub".to_string(),
        });
    }

    // Add QQ identity if configured
    let qq_app_id = oauth_service.qq_app_id();
    if !qq_app_id.is_empty() {
        identities.push(BindableIdentity {
            provider: "qq".to_string(),
            name: "QQ".to_string(),
        });
    }

    Ok(Json(identities))
}

/// Bind an OAuth-authenticated user to an existing anonymous reader identity.
///
/// When a first-time OAuth login creates a temporary account (no Reader record),
/// and the user has previously left anonymous comments, they can bind to that
/// pre-existing anonymous Reader so their comment history is preserved.
///
/// Flow:
/// 1. Locate the anonymous Reader by `name` + `email`.
/// 2. Re-assign all OAuth Accounts from the temp `user_id` to the anonymous reader's id.
/// 3. Delete the now-orphaned temp Reader (if one exists).
/// 4. Issue a new JWT for the anonymous reader's id.
pub async fn bind_anonymous(
    State(state): State<SharedState>,
    auth: OptionalAuth,
    AppJson(payload): AppJson<BindAnonymousRequest>,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    let user_id = auth.user_id.ok_or(AppError::Unauthorized)?;

    let readers = state.db.collection::<Reader>("readers");
    let accounts = state.db.collection::<Account>("accounts");

    // 1. Find the anonymous reader to bind to
    let anon_reader = readers
        .find_one(doc! { "name": &payload.name, "email": &payload.email })
        .await
        .map_err(|e| AppError::Database(format!("Failed to query readers: {e}")))?
        .ok_or_else(|| AppError::NotFound("No matching anonymous identity found".to_string()))?;

    // 2. Re-assign all accounts from the temp user_id to the anonymous reader
    accounts
        .update_many(
            doc! { "userId": user_id },
            doc! { "$set": { "userId": anon_reader.id } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to merge accounts: {e}")))?;

    // 3. Delete the temp Reader record (if it exists for the old user_id)
    let _ = readers.delete_one(doc! { "_id": user_id }).await;

    // 4. Issue a new JWT for the anonymous reader
    let token = generate_jwt(
        anon_reader.id,
        anon_reader.is_owner,
        &state.config.jwt_secret,
    )
    .map_err(|e| AppError::Internal(format!("Failed to generate token: {e}")))?;

    tracing::info!(
        "Bound OAuth user {} to anonymous reader {} <{}>",
        user_id,
        anon_reader.name,
        anon_reader.email
    );

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: token,
        data: anon_reader.into(),
    }))
}

/// Skip the OAuth binding step and create a new Reader from the OAuth account data.
///
/// Called when a first-time OAuth user does not want to bind to an existing
/// anonymous identity and prefers to start with a fresh reader profile.
pub async fn skip_bind(
    State(state): State<SharedState>,
    auth: OptionalAuth,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    let user_id = auth.user_id.ok_or(AppError::Unauthorized)?;

    let readers = state.db.collection::<Reader>("readers");
    let accounts = state.db.collection::<Account>("accounts");

    // If a Reader already exists for this user_id, return it with a fresh token
    if let Some(existing) = readers
        .find_one(doc! { "_id": user_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to query readers: {e}")))?
    {
        let token = generate_jwt(existing.id, existing.is_owner, &state.config.jwt_secret)
            .map_err(|e| AppError::Internal(format!("Failed to generate token: {e}")))?;

        return Ok(Json(ApiResponse {
            code: 200,
            status: ResponseStatus::Success,
            message: token,
            data: existing.into(),
        }));
    }

    // Find an OAuth account for this user_id to populate the new Reader
    let mut cursor = accounts
        .find(doc! { "userId": user_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to query accounts: {e}")))?;

    let acc = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(format!("Failed to read account cursor: {e}")))?
        .ok_or_else(|| AppError::NotFound("No OAuth account found for this session".to_string()))?;

    // The first reader becomes the owner
    let reader_count = readers.count_documents(doc! {}).await.unwrap_or(1); // default to non-empty so as not to accidentally grant ownership
    let is_first = reader_count == 0;

    // Build the new Reader from OAuth account data
    let name = acc.oauth_name.clone().unwrap_or_else(|| "用户".to_string());
    let email = acc
        .oauth_email
        .clone()
        .unwrap_or_else(|| format!("{}@oauth", acc.account_id));
    let handle = acc
        .oauth_handle
        .clone()
        .unwrap_or_else(|| Reader::generate_handle(&name));
    let image = acc.oauth_avatar.clone().unwrap_or_default();

    let new_reader = Reader {
        id: ObjectId::new(),
        name,
        email,
        handle,
        image,
        is_owner: is_first,
        email_verified: Some(true),
        created_at: bson::DateTime::now(),
        updated_at: bson::DateTime::now(),
    };

    let new_id = new_reader.id;

    readers
        .insert_one(&new_reader)
        .await
        .map_err(|e| AppError::Database(format!("Failed to create reader: {e}")))?;

    // Re-assign all accounts from the temp user_id to the new reader's id
    accounts
        .update_many(
            doc! { "userId": user_id },
            doc! { "$set": { "userId": new_id } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to update accounts: {e}")))?;

    let token = generate_jwt(new_id, is_first, &state.config.jwt_secret)
        .map_err(|e| AppError::Internal(format!("Failed to generate token: {e}")))?;

    tracing::info!(
        "Created new reader {} <{}> for OAuth user {}",
        new_reader.name,
        new_reader.email,
        user_id,
    );

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: token,
        data: new_reader.into(),
    }))
}

// ── Request / Response types ───────────────────────────────────────────────────

/// OAuth authorize query parameters
#[derive(Debug, Deserialize)]
pub struct OAuthAuthorizeQuery {
    /// 调用方标识：`admin` 表示来自 admin SPA 的弹窗登录，
    /// 缺省/`web` 表示走 web 评论侧的现有流程。
    pub return_to: Option<String>,
}

/// OAuth callback query parameters
#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
    /// 第三方原样回传的 state（含 return_to 等业务字段）。
    pub state: Option<String>,
}

/// Bindable identity response
#[derive(Debug, Clone, Serialize)]
pub struct BindableIdentity {
    pub provider: String,
    pub name: String,
}

/// Request body for binding to an anonymous reader identity.
/// Identifies the anonymous reader by the name + email used when commenting.
#[derive(Debug, Deserialize)]
pub struct BindAnonymousRequest {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Copy)]
enum OAuthProvider {
    GitHub,
    QQ,
}

async fn handle_oauth_callback(
    state: &SharedState,
    provider: OAuthProvider,
    code: &str,
    raw_state: Option<&str>,
) -> Redirect {
    let return_to = decode_oauth_state(raw_state);

    let oauth_service = match make_runtime_oauth_service(state).await {
        Ok(service) => service,
        Err(error) => {
            return build_oauth_error_redirect(state, &return_to, &app_error_message(&error));
        }
    };

    let user_info_result = match provider {
        OAuthProvider::GitHub => oauth_service.exchange_github_code(code).await,
        OAuthProvider::QQ => oauth_service.exchange_qq_code(code).await,
    };

    let user_info = match user_info_result {
        Ok(user_info) => user_info,
        Err(error) => {
            return build_oauth_error_redirect(state, &return_to, &app_error_message(&error));
        }
    };

    let login_result = match provider {
        OAuthProvider::GitHub => oauth_service.process_oauth_login(user_info).await,
        OAuthProvider::QQ => oauth_service.process_qq_oauth_login(user_info).await,
    };

    let (user_id, is_owner, is_new_user) = match login_result {
        Ok(result) => result,
        Err(error) => {
            return build_oauth_error_redirect(state, &return_to, &app_error_message(&error));
        }
    };

    let object_id = match ObjectId::parse_str(&user_id) {
        Ok(object_id) => object_id,
        Err(_) => return build_oauth_error_redirect(state, &return_to, "Invalid user ID"),
    };

    let token = match generate_jwt(object_id, is_owner, &state.config.jwt_secret) {
        Ok(token) => token,
        Err(error) => {
            return build_oauth_error_redirect(
                state,
                &return_to,
                &format!("Failed to generate token: {error}"),
            );
        }
    };

    let url = format!(
        "{}?token={}&new_user={}",
        callback_base_url(state, &return_to),
        urlencoding::encode(&token),
        is_new_user
    );

    Redirect::to(&url)
}

fn build_oauth_error_redirect(
    state: &SharedState,
    return_to: &OAuthReturnTo,
    message: &str,
) -> Redirect {
    let url = format!(
        "{}?error={}",
        callback_base_url(state, return_to),
        urlencoding::encode(message)
    );
    Redirect::to(&url)
}

/// 把 `state` query 编码成"return_to=xxx"形式。空 return_to 时返回空串，让上游
/// 决定要不要拼到第三方 URL（OAuth 第三方都接受空 state）。
fn encode_oauth_state(return_to: &str) -> String {
    let trimmed = return_to.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    format!("return_to={}", urlencoding::encode(trimmed))
}

/// 解析 callback 拿到的原始 `state` 字符串，目前只关心 `return_to` 字段。
fn decode_oauth_state(raw_state: Option<&str>) -> OAuthReturnTo {
    let raw = match raw_state {
        Some(value) if !value.is_empty() => value,
        _ => return OAuthReturnTo::Web,
    };
    for pair in raw.split('&') {
        let mut iter = pair.splitn(2, '=');
        let key = iter.next().unwrap_or_default();
        let value = iter.next().unwrap_or_default();
        if key == "return_to" {
            let decoded = urlencoding::decode(value)
                .map(|cow| cow.into_owned())
                .unwrap_or_else(|_| value.to_string());
            return match decoded.as_str() {
                "admin" => OAuthReturnTo::Admin,
                _ => OAuthReturnTo::Web,
            };
        }
    }
    OAuthReturnTo::Web
}

/// 根据 return_to 拼出最终承接 token 的 callback 页 URL（不含 query）。
fn callback_base_url(state: &SharedState, return_to: &OAuthReturnTo) -> String {
    match return_to {
        OAuthReturnTo::Admin => format!(
            "{}{}/#/auth/callback",
            state.config.backend_url,
            crate::admin_dashboard::ADMIN_DASHBOARD_PROXY_PATH
        ),
        OAuthReturnTo::Web => format!("{}/auth/callback", state.config.frontend_url),
    }
}

#[derive(Debug, Clone, Copy)]
enum OAuthReturnTo {
    Admin,
    Web,
}

fn app_error_message(error: &AppError) -> String {
    match error {
        AppError::NotFound(message)
        | AppError::BadRequest(message)
        | AppError::Database(message)
        | AppError::Internal(message)
        | AppError::OAuthFailed(message)
        | AppError::ConfigError(message) => message.clone(),
        AppError::Unauthorized | AppError::MissingAuthHeader | AppError::InvalidToken => {
            "Unauthorized".to_string()
        }
        AppError::Forbidden => "Forbidden".to_string(),
        AppError::SpamDetected => "Spam detected".to_string(),
        AppError::TokenExpired => "Token expired".to_string(),
    }
}
