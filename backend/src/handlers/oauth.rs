//! OAuth authentication handlers

use crate::services::helpers::make_oauth_service;
use crate::{
    app::SharedState,
    auth::{extractors::OptionalAuth, jwt::generate_jwt},
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{Json, extract::State};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};

/// GitHub OAuth authorization
pub async fn github_oauth(
    State(state): State<SharedState>,
) -> AppResult<Json<OAuthAuthorizeResponse>> {
    let oauth_service = make_oauth_service(&state);
    let url = oauth_service.github_authorize_url()?;

    Ok(Json(OAuthAuthorizeResponse { url }))
}

/// GitHub OAuth callback
pub async fn github_callback(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<OAuthCallbackQuery>,
) -> AppResult<Json<OAuthCallbackResponse>> {
    let oauth_service = make_oauth_service(&state);

    let user_info = oauth_service.exchange_github_code(&query.code).await?;

    let (user_id, is_owner, _is_new_user) = oauth_service.process_oauth_login(user_info).await?;

    let token = generate_jwt(
        ObjectId::parse_str(&user_id)
            .map_err(|_| AppError::Internal("Invalid user ID".to_string()))?,
        is_owner,
        &state.config.jwt_secret,
    )
    .map_err(|e| AppError::Internal(format!("Failed to generate token: {}", e)))?;

    Ok(Json(OAuthCallbackResponse { token }))
}

/// QQ OAuth authorization
pub async fn qq_oauth(State(state): State<SharedState>) -> AppResult<Json<OAuthAuthorizeResponse>> {
    let oauth_service = make_oauth_service(&state);
    let url = oauth_service.qq_authorize_url()?;

    Ok(Json(OAuthAuthorizeResponse { url }))
}

/// QQ OAuth callback
pub async fn qq_callback(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<OAuthCallbackQuery>,
) -> AppResult<Json<OAuthCallbackResponse>> {
    let oauth_service = make_oauth_service(&state);

    let user_info = oauth_service.exchange_qq_code(&query.code).await?;

    let (user_id, is_owner, _is_new_user) = oauth_service.process_qq_oauth_login(user_info).await?;

    let token = generate_jwt(
        ObjectId::parse_str(&user_id)
            .map_err(|_| AppError::Internal("Invalid user ID".to_string()))?,
        is_owner,
        &state.config.jwt_secret,
    )
    .map_err(|e| AppError::Internal(format!("Failed to generate token: {}", e)))?;

    Ok(Json(OAuthCallbackResponse { token }))
}

/// Get bindable OAuth identities for anonymous user
pub async fn get_bindable_identities(
    State(state): State<SharedState>,
) -> AppResult<Json<Vec<BindableIdentity>>> {
    let oauth_service = make_oauth_service(&state);

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

/// OAuth callback query parameters
#[derive(Debug, Deserialize)]
pub struct OAuthCallbackQuery {
    pub code: String,
}

/// OAuth authorize response
#[derive(Debug, Serialize)]
pub struct OAuthAuthorizeResponse {
    pub url: String,
}

/// OAuth callback response
#[derive(Debug, Serialize)]
pub struct OAuthCallbackResponse {
    pub token: String,
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
