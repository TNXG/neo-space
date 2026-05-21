//! Authentication and account management handlers

use crate::services::helpers::is_owner_user_id;
use crate::services::helpers::make_oauth_service;
use crate::{
    app::SharedState,
    auth::extractors::AuthUser,
    error::{AppError, AppJson, AppResult},
    models::*,
};
use axum::{Json, extract::State};
use bson::doc;
use futures::stream::TryStreamExt;
use serde::Deserialize;

/// Request body for the update-avatar endpoint
#[derive(Debug, Deserialize)]
pub struct UpdateAvatarRequest {
    pub avatar: String,
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
