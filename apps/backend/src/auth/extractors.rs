//! Authentication extractors for Axum

use axum::{
    extract::FromRequestParts,
    http::{header::COOKIE, request::Parts},
};
use bson::oid::ObjectId;

use crate::{app::AppState, auth::jwt, error::AppError, services::helpers::is_owner_user_id};

const ADMIN_AUTH_COOKIE: &str = "admin-auth-token";

/// Authenticated user extractor
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: ObjectId,
    pub is_owner: bool,
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync + AsRef<AppState>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        // Try to get SharedState from extensions
        // In Axum 0.7+, we need to use State extension or extract it differently
        // For now, we'll use the environment variable approach

        let token = extract_bearer_token(parts)
            .or_else(|| extract_cookie_token(parts))
            .ok_or(AppError::MissingAuthHeader)?;

        // Try to get JWT secret from extensions (set by middleware)
        let secret = if let Some(Some(secret)) = parts.extensions.get::<Option<String>>() {
            secret.clone()
        } else {
            // Require JWT_SECRET environment variable
            std::env::var("JWT_SECRET")
                .map_err(|_| AppError::Internal("JWT_SECRET not configured".to_string()))?
        };

        let claims = jwt::verify_jwt(&token, &secret).map_err(|e| match e {
            jwt::JwtError::TokenExpired => AppError::TokenExpired,
            _ => AppError::InvalidToken,
        })?;

        let user_id = claims.user_id().map_err(|_| AppError::InvalidToken)?;

        let is_owner = match is_owner_user_id(&state.as_ref().db, user_id).await {
            Ok(value) => value,
            Err(error) => {
                tracing::warn!("Failed to resolve owner status from database: {}", error);
                claims.is_owner
            }
        };

        Ok(AuthUser { user_id, is_owner })
    }
}

/// Optional authentication extractor
#[derive(Debug, Clone)]
pub struct OptionalAuth {
    pub user_id: Option<ObjectId>,
    pub is_owner: bool,
}

impl<S> FromRequestParts<S> for OptionalAuth
where
    S: Send + Sync + AsRef<AppState>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let token = extract_bearer_token(parts).or_else(|| extract_cookie_token(parts));

        match token {
            Some(token) => {
                let secret = if let Some(Some(secret)) = parts.extensions.get::<Option<String>>() {
                    secret.clone()
                } else {
                    // If JWT_SECRET not found, treat as unauthenticated
                    match std::env::var("JWT_SECRET") {
                        Ok(s) => s,
                        Err(_) => {
                            return Ok(OptionalAuth {
                                user_id: None,
                                is_owner: false,
                            });
                        }
                    }
                };

                match jwt::verify_jwt(&token, &secret) {
                    Ok(claims) => {
                        let user_id = claims.user_id().ok();
                        let is_owner = if let Some(user_id) = user_id {
                            match is_owner_user_id(&state.as_ref().db, user_id).await {
                                Ok(value) => value,
                                Err(error) => {
                                    tracing::warn!(
                                        "Failed to resolve owner status from database: {}",
                                        error
                                    );
                                    claims.is_owner
                                }
                            }
                        } else {
                            false
                        };

                        Ok(OptionalAuth { user_id, is_owner })
                    }
                    Err(_) => Ok(OptionalAuth {
                        user_id: None,
                        is_owner: false,
                    }),
                }
            }
            None => Ok(OptionalAuth {
                user_id: None,
                is_owner: false,
            }),
        }
    }
}

fn extract_bearer_token(parts: &Parts) -> Option<String> {
    let auth_header = parts
        .headers
        .get("Authorization")
        .and_then(|h| h.to_str().ok())?;

    auth_header
        .strip_prefix("Bearer ")
        .map(|token| token.to_string())
}

fn extract_cookie_token(parts: &Parts) -> Option<String> {
    let cookie_header = parts.headers.get(COOKIE).and_then(|h| h.to_str().ok())?;

    cookie_header.split(';').find_map(|cookie| {
        let (name, value) = cookie.trim().split_once('=')?;
        (name == ADMIN_AUTH_COOKIE && !value.is_empty()).then(|| value.to_string())
    })
}

/// Owner-only extractor - requires authentication and owner role
#[derive(Debug, Clone)]
pub struct OwnerOnly {
    pub _user_id: ObjectId,
}

impl<S> FromRequestParts<S> for OwnerOnly
where
    S: Send + Sync + AsRef<AppState>,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_user = AuthUser::from_request_parts(parts, _state).await?;

        if !auth_user.is_owner {
            return Err(AppError::Forbidden);
        }

        Ok(OwnerOnly {
            _user_id: auth_user.user_id,
        })
    }
}
