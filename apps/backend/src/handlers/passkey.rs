//! 后台 Owner Passkey 注册、管理与认证接口。

use axum::{
    Json,
    extract::{Path, State},
    http::HeaderMap,
};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use passkey_auth::{
    AuthenticationChallenge as PublicKeyAuthenticationOptions, AuthenticationResponse,
    CredentialId, RegistrationChallenge as PublicKeyRegistrationOptions, RegistrationResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
    options: PublicKeyOptions<PublicKeyRegistrationOptions>,
}

#[derive(Debug, Serialize)]
struct PublicKeyOptions<T> {
    #[serde(rename = "publicKey")]
    public_key: T,
}

#[derive(Debug, Deserialize)]
pub struct RegistrationFinishRequest {
    #[serde(rename = "challengeId")]
    challenge_id: String,
    name: String,
    credential: RegistrationCredential,
}

#[derive(Debug, Deserialize)]
struct RegistrationCredential {
    id: String,
    response: RegistrationCredentialResponse,
}

#[derive(Debug, Deserialize)]
struct RegistrationCredentialResponse {
    #[serde(rename = "attestationObject")]
    attestation_object: String,
    #[serde(rename = "clientDataJSON")]
    client_data_json: String,
    #[serde(default)]
    transports: Vec<String>,
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
    options: PublicKeyOptions<PublicKeyAuthenticationOptions>,
}

#[derive(Debug, Deserialize)]
pub struct AuthenticationFinishRequest {
    #[serde(rename = "challengeId")]
    challenge_id: String,
    credential: AuthenticationCredential,
}

#[derive(Debug, Deserialize)]
struct AuthenticationCredential {
    id: String,
    response: AuthenticationCredentialResponse,
}

#[derive(Debug, Deserialize)]
struct AuthenticationCredentialResponse {
    #[serde(rename = "authenticatorData")]
    authenticator_data: String,
    #[serde(rename = "clientDataJSON")]
    client_data_json: String,
    signature: String,
    #[serde(rename = "userHandle", default)]
    user_handle: Option<String>,
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
        .map(|passkey| passkey.credential.id.clone())
        .collect::<Vec<CredentialId>>();
    let (options, registration_state) = service.webauthn.start_registration(
        &owner._user_id.bytes(),
        &reader.handle,
        &reader.name,
        &excluded,
    );
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
        options: PublicKeyOptions {
            public_key: options,
        },
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

    let registration_response = request.credential.into_response();
    let credential = service
        .webauthn
        .finish_registration(&challenge.state, &registration_response)
        .map_err(|error| AppError::BadRequest(format!("Passkey registration failed: {error}")))?;
    ensure_credential_is_unique(&state, &credential.id).await?;
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
        .start_authentication_with_creds_for_user(&reader.id.bytes(), &credentials);
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
        options: PublicKeyOptions {
            public_key: options,
        },
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
    let mut passkeys = load_passkeys(&state, challenge.user_id).await?;
    let authentication_response = request.credential.into_response();
    let asserted_id = CredentialId::from_b64url(&authentication_response.id)
        .map_err(|_error| AppError::Unauthorized)?;
    let matched = passkeys
        .iter_mut()
        .find(|passkey| passkey.credential.id == asserted_id)
        .ok_or(AppError::Unauthorized)?;
    let authentication_result = service
        .webauthn
        .finish_authentication(
            &challenge.state,
            &authentication_response,
            &matched.credential,
        )
        .map_err(|_error| AppError::Unauthorized)?;
    matched.credential.counter = authentication_result.new_counter;
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
    credential_id: &CredentialId,
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
        if &passkey.credential.id == credential_id {
            return Err(AppError::BadRequest(
                "This Passkey is already registered".to_string(),
            ));
        }
    }
    Ok(())
}

impl RegistrationCredential {
    /// 将 SimpleWebAuthn 的嵌套响应转换为纯 Rust 校验库使用的线性结构。
    fn into_response(self) -> RegistrationResponse {
        RegistrationResponse {
            id: self.id,
            transports: self.response.transports,
            attestation_object: self.response.attestation_object,
            client_data_json: self.response.client_data_json,
        }
    }
}

impl AuthenticationCredential {
    /// 将 SimpleWebAuthn 的嵌套响应转换为纯 Rust 校验库使用的线性结构。
    fn into_response(self) -> AuthenticationResponse {
        AuthenticationResponse {
            id: self.id,
            authenticator_data: self.response.authenticator_data,
            signature: self.response.signature,
            client_data_json: self.response.client_data_json,
            user_handle: self.response.user_handle,
        }
    }
}
