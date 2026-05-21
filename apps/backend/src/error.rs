//! Unified error handling for the Axum backend

use axum::{
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde_json::json;

/// Unified application error type
#[allow(dead_code)]
pub enum AppError {
    NotFound(String),
    BadRequest(String),
    Unauthorized,
    Forbidden,
    Database(String),
    Internal(String),
    SpamDetected,
    OAuthFailed(String),
    InvalidToken,
    TokenExpired,
    MissingAuthHeader,
    ConfigError(String),
}

impl std::fmt::Debug for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "NotFound: {}", msg),
            Self::BadRequest(msg) => write!(f, "BadRequest: {}", msg),
            Self::Unauthorized => write!(f, "Unauthorized"),
            Self::Forbidden => write!(f, "Forbidden"),
            Self::Database(msg) => write!(f, "Database: {}", msg),
            Self::Internal(msg) => write!(f, "Internal: {}", msg),
            Self::SpamDetected => write!(f, "SpamDetected"),
            Self::OAuthFailed(msg) => write!(f, "OAuthFailed: {}", msg),
            Self::InvalidToken => write!(f, "InvalidToken"),
            Self::TokenExpired => write!(f, "TokenExpired"),
            Self::MissingAuthHeader => write!(f, "MissingAuthHeader"),
            Self::ConfigError(msg) => write!(f, "ConfigError: {}", msg),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            Self::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            Self::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            Self::Unauthorized | Self::InvalidToken | Self::MissingAuthHeader => {
                (StatusCode::UNAUTHORIZED, "Unauthorized".to_string())
            }
            Self::Forbidden => (StatusCode::FORBIDDEN, "Forbidden".to_string()),
            Self::Database(msg) => {
                tracing::error!("Database error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal database error".to_string(),
                )
            }
            Self::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }
            Self::SpamDetected => (StatusCode::FORBIDDEN, "Spam detected".to_string()),
            Self::OAuthFailed(msg) => (StatusCode::BAD_REQUEST, format!("OAuth failed: {}", msg)),
            Self::TokenExpired => (StatusCode::UNAUTHORIZED, "Token expired".to_string()),
            Self::ConfigError(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Config error: {}", msg),
            ),
        };

        tracing::error!("AppError: {} (HTTP {})", message, status.as_u16());

        let body = json!({
            "code": status.as_u16(),
            "status": "failed",
            "message": message
        });

        (status, Json(body)).into_response()
    }
}

/// Type alias for Result with AppError
pub type AppResult<T> = Result<T, AppError>;

// Implement From implementations for common error types

impl From<mongodb::error::Error> for AppError {
    fn from(err: mongodb::error::Error) -> Self {
        AppError::Database(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Internal(format!("JSON error: {}", err))
    }
}

// ─── Custom extractors ──────────────────────────────────────────────────────

/// Wrapper around `axum::Json` that returns a JSON error response on rejection
/// instead of axum's default plain-text 422.
pub struct AppJson<T>(pub T);

impl<T> std::ops::Deref for AppJson<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T, S> axum::extract::FromRequest<S> for AppJson<T>
where
    T: serde::de::DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request(req: axum::extract::Request, state: &S) -> Result<Self, Self::Rejection> {
        match axum::Json::<T>::from_request(req, state).await {
            Ok(axum::Json(value)) => Ok(AppJson(value)),
            Err(rejection) => {
                use axum::extract::rejection::JsonRejection;
                let msg = match &rejection {
                    JsonRejection::JsonDataError(e) => {
                        format!("Invalid JSON data: {}", e.body_text())
                    }
                    JsonRejection::JsonSyntaxError(e) => {
                        format!("JSON syntax error: {}", e.body_text())
                    }
                    JsonRejection::MissingJsonContentType(_) => {
                        "Missing Content-Type: application/json header".to_string()
                    }
                    _ => format!("Bad request: {}", rejection.body_text()),
                };
                Err(AppError::BadRequest(msg))
            }
        }
    }
}

/// Wrapper around `axum::extract::Query` that returns a JSON error response on
/// rejection instead of axum's default plain-text 400.
pub struct AppQuery<T>(pub T);

impl<T> std::ops::Deref for AppQuery<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T, S> axum::extract::FromRequestParts<S> for AppQuery<T>
where
    T: serde::de::DeserializeOwned,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut axum::http::request::Parts,
        state: &S,
    ) -> Result<Self, Self::Rejection> {
        match axum::extract::Query::<T>::from_request_parts(parts, state).await {
            Ok(axum::extract::Query(value)) => Ok(AppQuery(value)),
            Err(rejection) => Err(AppError::BadRequest(format!(
                "Invalid query parameters: {}",
                rejection.body_text()
            ))),
        }
    }
}

// ─── Fallback handler ────────────────────────────────────────────────────────

/// 404 fallback for unmatched routes – always returns JSON.
pub async fn fallback_404(uri: axum::http::Uri) -> impl axum::response::IntoResponse {
    AppError::NotFound(format!("Endpoint not found: {}", uri.path()))
}
