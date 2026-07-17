//! 后台 Owner Passkey 注册、管理与认证接口。

use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};
use webauthn_rs::prelude::{
    CreationChallengeResponse, CredentialID, PublicKeyCredential, RegisterPublicKeyCredential,
    RequestChallengeResponse, Uuid,
};

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    handlers::auth::{TokenResponse, find_owner_reader, issue_admin_session, load_owner_reader},
    models::{ApiResponse, PasskeySummary, Reader, StoredPasskey},
    services::passkey::{AuthenticationChallenge, PasskeyService, RegistrationChallenge},
};

#[derive(Debug, Deserialize)]
pub struct RegistrationStartRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct RegistrationStartResponse {
    #[serde(rename = "challengeId")]
    challenge_id: String,
    options: CreationChallengeResponse,
}

#[derive(Debug, Deserialize)]
pub struct RegistrationFinishRequest {
    #[serde(rename = "challengeId")]
    challenge_id: String,
    name: String,
    credential: RegisterPublicKeyCredential,
}

#[derive(Debug, Deserialize)]
pub struct AuthenticationStartRequest {
    #[serde(default)]
    pub identifier: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthenticationStartResponse {
    #[serde(rename = "challengeId")]
    challenge_id: String,
    options: RequestChallengeResponse,
}

#[derive(Debug, Deserialize)]
pub struct AuthenticationFinishRequest {
    #[serde(rename = "challengeId")]
    challenge_id: String,
    credential: PublicKeyCredential,
}

/// 返回当前 Owner 已注册的 Passkey。
pub async fn list_passkeys(
    State(state): State<SharedState>,
    owner: OwnerOnly,
) -> AppResult<Json<ApiResponse<Vec<PasskeySummary>>>> {
    let passkeys = load_passkeys(&state, owner._user_id).await?;
    let summaries = passkeys
        .into_iter()
        .map(|passkey| PasskeySummary {
            id: passkey.id.to_hex(),
            name: passkey.name,
            created_at: passkey.created_at,
            last_used_at: passkey.last_used_at,
        })
        .collect();
    Ok(Json(ApiResponse::success(summaries)))
}

/// 创建注册挑战，并把挑战状态仅保存在服务端短期缓存中。
pub async fn start_registration(
    State(state): State<SharedState>,
    owner: OwnerOnly,
    AppJson(request): AppJson<RegistrationStartRequest>,
) -> AppResult<Json<ApiResponse<RegistrationStartResponse>>> {
    let name = request.name.trim();
    if name.is_empty() {
        return Err(AppError::BadRequest("Passkey name is required".to_string()));
    }
    let service = passkey_service(&state)?;
    let reader = load_reader(&state, owner._user_id).await?;
    let existing = load_passkeys(&state, owner._user_id).await?;
    let excluded = existing
        .iter()
        .map(|passkey| passkey.credential.cred_id().clone())
        .collect::<Vec<CredentialID>>();
    let (options, registration_state) = service
        .webauthn
        .start_passkey_registration(
            object_id_to_uuid(owner._user_id),
            &reader.handle,
            &reader.name,
            (!excluded.is_empty()).then_some(excluded),
        )
        .map_err(|error| {
            AppError::Internal(format!("Failed to start passkey registration: {error}"))
        })?;
    let challenge_id = Uuid::new_v4().to_string();
    service
        .registration_challenges
        .insert(
            challenge_id.clone(),
            RegistrationChallenge {
                user_id: owner._user_id,
                state: registration_state,
            },
        )
        .await;

    Ok(Json(ApiResponse::success(RegistrationStartResponse {
        challenge_id,
        options,
    })))
}

/// 校验浏览器注册响应并持久化新的 Passkey。
pub async fn finish_registration(
    State(state): State<SharedState>,
    owner: OwnerOnly,
    AppJson(request): AppJson<RegistrationFinishRequest>,
) -> AppResult<Json<ApiResponse<PasskeySummary>>> {
    let service = passkey_service(&state)?;
    let challenge = service
        .registration_challenges
        .get(&request.challenge_id)
        .await
        .ok_or_else(|| AppError::BadRequest("Passkey challenge expired".to_string()))?;
    service
        .registration_challenges
        .invalidate(&request.challenge_id)
        .await;
    if challenge.user_id != owner._user_id {
        return Err(AppError::Forbidden);
    }

    let credential = service
        .webauthn
        .finish_passkey_registration(&request.credential, &challenge.state)
        .map_err(|error| AppError::BadRequest(format!("Passkey registration failed: {error}")))?;
    ensure_credential_is_unique(&state, credential.cred_id()).await?;
    let passkey = StoredPasskey {
        id: ObjectId::new(),
        user_id: owner._user_id,
        name: request.name.trim().to_string(),
        credential,
        created_at: bson::DateTime::now(),
        last_used_at: None,
    };
    state
        .db
        .collection::<StoredPasskey>("passkeys")
        .insert_one(&passkey)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    Ok(Json(ApiResponse::success(PasskeySummary {
        id: passkey.id.to_hex(),
        name: passkey.name,
        created_at: passkey.created_at,
        last_used_at: None,
    })))
}

/// 删除当前 Owner 指定的 Passkey。
pub async fn delete_passkey(
    State(state): State<SharedState>,
    owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid Passkey ID".to_string()))?;
    let result = state
        .db
        .collection::<StoredPasskey>("passkeys")
        .delete_one(doc! { "_id": object_id, "userId": owner._user_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    if result.deleted_count == 0 {
        return Err(AppError::NotFound("Passkey not found".to_string()));
    }
    Ok(Json(ApiResponse::success(())))
}

/// 根据邮箱/username 创建挑战；条件式 UI 可省略 identifier 使用 Owner 可发现凭据。
pub async fn start_authentication(
    State(state): State<SharedState>,
    AppJson(request): AppJson<AuthenticationStartRequest>,
) -> AppResult<Json<ApiResponse<AuthenticationStartResponse>>> {
    let service = passkey_service(&state)?;
    let reader = match request
        .identifier
        .as_deref()
        .map(str::trim)
        .filter(|identifier| !identifier.is_empty())
    {
        Some(identifier) => find_owner_reader(&state, identifier).await?,
        None => load_owner_reader(&state).await?,
    };
    let passkeys = load_passkeys(&state, reader.id).await?;
    if passkeys.is_empty() {
        return Err(AppError::Unauthorized);
    }
    let credentials = passkeys
        .iter()
        .map(|passkey| passkey.credential.clone())
        .collect::<Vec<_>>();
    let (options, authentication_state) = service
        .webauthn
        .start_passkey_authentication(&credentials)
        .map_err(|error| {
            AppError::Internal(format!("Failed to start passkey authentication: {error}"))
        })?;
    let challenge_id = Uuid::new_v4().to_string();
    service
        .authentication_challenges
        .insert(
            challenge_id.clone(),
            AuthenticationChallenge {
                user_id: reader.id,
                state: authentication_state,
            },
        )
        .await;

    Ok(Json(ApiResponse::success(AuthenticationStartResponse {
        challenge_id,
        options,
    })))
}

/// 校验 Passkey 登录响应、更新凭据计数器并签发管理员会话。
pub async fn finish_authentication(
    State(state): State<SharedState>,
    AppJson(request): AppJson<AuthenticationFinishRequest>,
) -> AppResult<(HeaderMap, Json<ApiResponse<TokenResponse>>)> {
    let service = passkey_service(&state)?;
    let challenge = service
        .authentication_challenges
        .get(&request.challenge_id)
        .await
        .ok_or_else(|| AppError::BadRequest("Passkey challenge expired".to_string()))?;
    service
        .authentication_challenges
        .invalidate(&request.challenge_id)
        .await;
    let authentication_result = service
        .webauthn
        .finish_passkey_authentication(&request.credential, &challenge.state)
        .map_err(|_error| AppError::Unauthorized)?;

    let mut passkeys = load_passkeys(&state, challenge.user_id).await?;
    let matched = passkeys
        .iter_mut()
        .find(|passkey| passkey.credential.cred_id() == authentication_result.cred_id())
        .ok_or(AppError::Unauthorized)?;
    matched.credential.update_credential(&authentication_result);
    matched.last_used_at = Some(bson::DateTime::now());
    state
        .db
        .collection::<StoredPasskey>("passkeys")
        .replace_one(doc! { "_id": matched.id }, &*matched)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    let reader = load_reader(&state, challenge.user_id).await?;
    issue_admin_session(&state, reader)
}

/// 获取已启用的 Passkey 服务。
fn passkey_service(state: &SharedState) -> AppResult<&PasskeyService> {
    state
        .passkey_service
        .as_ref()
        .ok_or_else(|| AppError::ConfigError("Passkey is not configured".to_string()))
}

/// 读取指定 Owner 的完整 Passkey 凭据。
async fn load_passkeys(state: &SharedState, user_id: ObjectId) -> AppResult<Vec<StoredPasskey>> {
    state
        .db
        .collection::<StoredPasskey>("passkeys")
        .find(doc! { "userId": user_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect()
        .await
        .map_err(|error| AppError::Database(error.to_string()))
}

/// 读取 Passkey 所属用户。
async fn load_reader(state: &SharedState, user_id: ObjectId) -> AppResult<Reader> {
    state
        .db
        .collection::<Reader>("readers")
        .find_one(doc! { "_id": user_id })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::NotFound("Owner reader not found".to_string()))
}

/// 保证同一个认证器凭据不会绑定到多个账号。
async fn ensure_credential_is_unique(
    state: &SharedState,
    credential_id: &CredentialID,
) -> AppResult<()> {
    let mut cursor = state
        .db
        .collection::<StoredPasskey>("passkeys")
        .find(doc! {})
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    while let Some(passkey) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        if passkey.credential.cred_id() == credential_id {
            return Err(AppError::BadRequest(
                "This Passkey is already registered".to_string(),
            ));
        }
    }
    Ok(())
}

/// 将 MongoDB ObjectId 稳定映射为 WebAuthn 用户 UUID。
fn object_id_to_uuid(object_id: ObjectId) -> Uuid {
    let mut bytes = [0_u8; 16];
    bytes[4..].copy_from_slice(&object_id.bytes());
    Uuid::from_bytes(bytes)
}
