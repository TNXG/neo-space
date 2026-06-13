//! Authentication and account management handlers

use crate::services::helpers::is_owner_user_id;
use crate::services::helpers::make_oauth_service;
use crate::{
    app::SharedState,
    auth::{extractors::AuthUser, jwt::generate_jwt},
    error::{AppError, AppJson, AppResult},
    models::*,
};
use axum::{
    Json,
    extract::State,
    http::{HeaderMap, HeaderValue, header::SET_COOKIE},
};
use bson::{Bson, Document, doc};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};

const ADMIN_AUTH_COOKIE: &str = "admin-auth-token";

/// Request body for issuing an admin JWT.
#[derive(Debug, Deserialize)]
pub struct CreateTokenRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub user: ReaderResponse,
}

/// Request body for the update-avatar endpoint
#[derive(Debug, Deserialize)]
pub struct UpdateAvatarRequest {
    pub avatar: String,
}

/// Issue an admin JWT after verifying the submitted password.
pub async fn create_token(
    State(state): State<SharedState>,
    AppJson(payload): AppJson<CreateTokenRequest>,
) -> AppResult<(HeaderMap, Json<ApiResponse<TokenResponse>>)> {
    let (reader, account) = find_owner_credential_account(&state, &payload.username).await?;
    let stored_hash = account_password_hash(&account)?;

    let password_matches = bcrypt::verify(&payload.password, stored_hash).unwrap_or(false);
    if !password_matches {
        return Err(AppError::Unauthorized);
    }

    let token = generate_jwt(reader.id, true, &state.config.jwt_secret)
        .map_err(|e| AppError::Internal(format!("Failed to generate token: {e}")))?;

    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, build_admin_auth_cookie(&token)?);

    Ok((
        headers,
        Json(ApiResponse::success(TokenResponse {
            token,
            user: ReaderResponse::from(reader),
        })),
    ))
}

/// Remove the admin JWT cookie. The token itself remains stateless.
pub async fn delete_token() -> AppResult<(HeaderMap, Json<ApiResponse<()>>)> {
    let mut headers = HeaderMap::new();
    headers.insert(SET_COOKIE, expire_admin_auth_cookie()?);

    Ok((headers, Json(ApiResponse::success(()))))
}

/// Return the current JWT-authenticated admin user.
pub async fn get_current_token_user(
    State(state): State<SharedState>,
    auth_user: AuthUser,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    if !auth_user.is_owner {
        return Err(AppError::Forbidden);
    }

    let collection = state.db.collection::<Reader>("readers");
    let reader = collection
        .find_one(doc! { "_id": auth_user.user_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to load current user: {e}")))?
        .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(ApiResponse::success(ReaderResponse {
        is_owner: true,
        ..ReaderResponse::from(reader)
    })))
}

/// Get current authenticated user info
pub async fn get_current_user(
    State(state): State<SharedState>,
    auth_user: AuthUser,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    let oauth_service = make_oauth_service(&state);

    let reader = oauth_service
        .get_current_user(&auth_user.user_id.to_hex())
        .await?;

    let is_owner = is_owner_user_id(&state.db, auth_user.user_id)
        .await
        .unwrap_or(auth_user.is_owner);

    let response = ReaderResponse {
        is_owner,
        ..ReaderResponse::from(reader)
    };

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: response,
    }))
}

/// Get current user's linked OAuth accounts
pub async fn get_user_accounts(
    State(state): State<SharedState>,
    auth_user: AuthUser,
) -> AppResult<Json<ApiResponse<Vec<AccountResponse>>>> {
    let accounts_collection = state.db.collection::<Account>("accounts");

    let mut cursor = accounts_collection
        .find(doc! { "userId": auth_user.user_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to find accounts: {}", e)))?;

    let mut accounts = Vec::new();
    while let Some(account) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(format!("Failed to iterate accounts: {}", e)))?
    {
        accounts.push(AccountResponse::from(account));
    }

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: accounts,
    }))
}

/// Update user avatar
pub async fn update_user_avatar(
    State(state): State<SharedState>,
    auth_user: AuthUser,
    AppJson(payload): AppJson<UpdateAvatarRequest>,
) -> AppResult<Json<ApiResponse<String>>> {
    let collection = state.db.collection::<Reader>("readers");

    collection
        .update_one(
            doc! { "_id": auth_user.user_id },
            doc! { "$set": { "image": &payload.avatar } },
        )
        .await
        .map_err(|e| AppError::Database(format!("Failed to update avatar: {}", e)))?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Avatar updated successfully".to_string(),
        data: payload.avatar,
    }))
}

async fn find_owner_credential_account(
    state: &SharedState,
    username: &str,
) -> AppResult<(Reader, Document)> {
    let username = username.trim();
    if username.is_empty() {
        return Err(AppError::BadRequest("Username is required".to_string()));
    }

    let reader = find_owner_reader(state, username).await?;
    let accounts = state.db.collection::<Document>("accounts");
    let account = accounts
        .find_one(doc! {
            "userId": reader.id,
            "$or": [
                { "providerId": "credential" },
                { "provider": "credential" },
                { "provider": "password" }
            ],
            "password": { "$type": "string" }
        })
        .await
        .map_err(|e| AppError::Database(format!("Failed to load credential account: {e}")))?
        .ok_or(AppError::Unauthorized)?;

    Ok((reader, account))
}

async fn find_owner_reader(state: &SharedState, username: &str) -> AppResult<Reader> {
    let readers = state.db.collection::<Reader>("readers");
    if let Some(reader) = readers
        .find_one(doc! {
            "$or": [
                { "handle": username },
                { "name": username },
                { "email": username }
            ]
        })
        .await
        .map_err(|e| AppError::Database(format!("Failed to load owner reader: {e}")))?
    {
        let is_owner = is_owner_user_id(&state.db, reader.id)
            .await
            .map_err(|e| AppError::Database(format!("Failed to resolve owner reader: {e}")))?;
        if is_owner {
            return Ok(reader);
        }
    }

    let owner_profiles = state.db.collection::<Document>("owner_profiles");
    let owner_profile = owner_profiles
        .find_one(doc! {})
        .await
        .map_err(|e| AppError::Database(format!("Failed to load owner profile: {e}")))?
        .ok_or(AppError::Unauthorized)?;

    let reader_id = owner_profile
        .get_object_id("readerId")
        .or_else(|_| owner_profile.get_object_id("reader_id"))
        .map_err(|_| AppError::Unauthorized)?;

    readers
        .find_one(doc! { "_id": reader_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to load owner reader: {e}")))?
        .filter(|reader| {
            reader.handle == username || reader.name == username || reader.email == username
        })
        .ok_or(AppError::Unauthorized)
}

fn account_password_hash(account: &Document) -> AppResult<&str> {
    match account.get("password") {
        Some(Bson::String(value)) if value.starts_with("$2") => Ok(value),
        _ => Err(AppError::Unauthorized),
    }
}

fn build_admin_auth_cookie(token: &str) -> AppResult<HeaderValue> {
    let cookie = format!(
        "{ADMIN_AUTH_COOKIE}={}; Path=/; Max-Age={}; HttpOnly; SameSite=Lax",
        token,
        7 * 24 * 60 * 60
    );
    HeaderValue::from_str(&cookie)
        .map_err(|e| AppError::Internal(format!("Failed to build auth cookie: {e}")))
}

fn expire_admin_auth_cookie() -> AppResult<HeaderValue> {
    HeaderValue::from_str("admin-auth-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
        .map_err(|e| AppError::Internal(format!("Failed to build auth cookie: {e}")))
}
