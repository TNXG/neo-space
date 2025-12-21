//! 统一错误处理模块

use rocket::serde::json::Json;
use rocket::http::Status;
use rocket::response::{self, Responder};
use rocket::Request;

use crate::models::{ApiResponse, ResponseStatus};

/// 认证错误类型
#[derive(Debug)]
#[allow(unused)]
pub enum AuthError {
    /// JWT token 无效
    InvalidToken,
    /// JWT token 已过期
    ExpiredToken,
    /// 缺少 Authorization header
    MissingAuthHeader,
    /// 权限不足（非 Owner）
    InsufficientPermissions,
    /// OAuth 提供商不支持
    UnsupportedProvider(String),
    /// OAuth 流程失败
    OAuthFlowFailed(String),
    /// 数据库操作失败
    DatabaseError(String),
    /// 用户不存在
    UserNotFound,
    /// 账号已被其他用户绑定
    AccountAlreadyLinked,
    /// 配置错误
    ConfigError(String),
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AuthError::InvalidToken => write!(f, "无效的认证令牌"),
            AuthError::ExpiredToken => write!(f, "认证令牌已过期"),
            AuthError::MissingAuthHeader => write!(f, "缺少认证信息"),
            AuthError::InsufficientPermissions => write!(f, "权限不足"),
            AuthError::UnsupportedProvider(provider) => {
                write!(f, "不支持的 OAuth 提供商: {}", provider)
            }
            AuthError::OAuthFlowFailed(msg) => write!(f, "OAuth 认证失败: {}", msg),
            AuthError::DatabaseError(msg) => write!(f, "数据库错误: {}", msg),
            AuthError::UserNotFound => write!(f, "用户不存在"),
            AuthError::AccountAlreadyLinked => write!(f, "该账号已被其他用户绑定"),
            AuthError::ConfigError(msg) => write!(f, "配置错误: {}", msg),
        }
    }
}

impl std::error::Error for AuthError {}

/// 将 AuthError 转换为 HTTP 响应
impl<'r> Responder<'r, 'static> for AuthError {
    fn respond_to(self, req: &'r Request<'_>) -> response::Result<'static> {
        let (status, code, message) = match &self {
            AuthError::InvalidToken | AuthError::ExpiredToken | AuthError::MissingAuthHeader => {
                (Status::Unauthorized, 401, self.to_string())
            }
            AuthError::InsufficientPermissions => (Status::Forbidden, 403, self.to_string()),
            AuthError::UserNotFound => (Status::NotFound, 404, self.to_string()),
            AuthError::UnsupportedProvider(_)
            | AuthError::AccountAlreadyLinked
            | AuthError::ConfigError(_) => (Status::BadRequest, 400, self.to_string()),
            AuthError::OAuthFlowFailed(_) | AuthError::DatabaseError(_) => {
                (Status::InternalServerError, 500, self.to_string())
            }
        };

        log::error!("认证错误: {} (HTTP {})", message, code);

        let response = ApiResponse {
            code,
            status: ResponseStatus::Failed,
            message,
            data: (),
        };

        response::status::Custom(status, Json(response)).respond_to(req)
    }
}

/// 从 JWT 错误转换为 AuthError
impl From<crate::utils::jwt::JwtError> for AuthError {
    fn from(err: crate::utils::jwt::JwtError) -> Self {
        match err {
            crate::utils::jwt::JwtError::InvalidToken => AuthError::InvalidToken,
            crate::utils::jwt::JwtError::TokenExpired => AuthError::ExpiredToken,
            crate::utils::jwt::JwtError::TokenGenerationFailed(_) 
            | crate::utils::jwt::JwtError::TokenVerificationFailed(_) => AuthError::InvalidToken,
        }
    }
}

/// 从配置错误转换为 AuthError
impl From<crate::config::ConfigError> for AuthError {
    fn from(err: crate::config::ConfigError) -> Self {
        AuthError::ConfigError(err.to_string())
    }
}

/// 从 MongoDB 错误转换为 AuthError
impl From<mongodb::error::Error> for AuthError {
    fn from(err: mongodb::error::Error) -> Self {
        AuthError::DatabaseError(err.to_string())
    }
}
