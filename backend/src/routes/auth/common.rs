//! 认证模块的公共类型和导入

use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket::{State, response::Redirect};
use rocket::http::{Cookie, CookieJar, SameSite};
use mongodb::Database;
use bson::oid::ObjectId;

use crate::config::OAuthConfig;
use crate::guards::AuthGuard;
use crate::models::{ApiResponse, ResponseStatus, Reader, ReaderResponse, Account, AccountResponse};
use crate::services::{
    ReaderRepository, AccountRepository, 
    GitHubOAuthService, QQOAuthService
};
use crate::utils::jwt::generate_jwt;

/// OAuth 登录结果（新用户时不创建 Reader）
pub(super) struct OAuthLoginResult {
    /// 用于 JWT 的 ID（老用户是 Reader ID，新用户是 Account ID）
    pub jwt_user_id: ObjectId,
    /// 是否是 Owner
    pub is_owner: bool,
    /// JWT token
    pub jwt_token: String,
    /// 是否是新用户
    pub is_new_user: bool,
}

/// 绑定匿名身份请求
#[derive(Debug, Deserialize, Serialize)]
pub struct BindAnonymousRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
}

/// 更新头像请求
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateAvatarRequest {
    pub provider: String, // "github" | "qq" | "gravatar"
}
