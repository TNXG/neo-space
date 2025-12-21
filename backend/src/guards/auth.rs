//! 认证守卫 - 验证 JWT token 并提取用户信息

use rocket::request::{FromRequest, Outcome, Request};
use rocket::http::Status;
use rocket::State;
use bson::oid::ObjectId;
use crate::config::OAuthConfig;
use crate::utils::jwt::verify_jwt;

/// 认证守卫 - 从 JWT token 中提取用户信息
#[derive(Debug, Clone)]
pub struct AuthGuard {
    pub user_id: ObjectId,
    #[allow(unused)]
    pub is_owner: bool,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for AuthGuard {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // 1. 从 Authorization header 获取 JWT token
        let token = match req.headers().get_one("Authorization") {
            Some(auth) => {
                if auth.starts_with("Bearer ") {
                    &auth[7..]
                } else {
                    log::warn!("Authorization header 格式错误，缺少 Bearer 前缀");
                    return Outcome::Error((Status::Unauthorized, ()));
                }
            }
            None => {
                log::warn!("缺少 Authorization header");
                return Outcome::Error((Status::Unauthorized, ()));
            }
        };

        // 2. 获取配置
        let config = match req.guard::<&State<OAuthConfig>>().await {
            Outcome::Success(config) => config,
            _ => {
                log::error!("无法获取 OAuthConfig");
                return Outcome::Error((Status::InternalServerError, ()));
            }
        };

        // 3. 验证 JWT token
        let claims = match verify_jwt(token, &config.jwt_secret) {
            Ok(claims) => claims,
            Err(e) => {
                log::warn!("JWT 验证失败: {:?}", e);
                return Outcome::Error((Status::Unauthorized, ()));
            }
        };

        // 4. 检查 token 是否过期
        if claims.is_expired() {
            log::warn!("JWT token 已过期");
            return Outcome::Error((Status::Unauthorized, ()));
        }

        // 5. 解析 user_id
        let user_id = match claims.user_id() {
            Ok(id) => id,
            Err(e) => {
                log::error!("解析 user_id 失败: {:?}", e);
                return Outcome::Error((Status::Unauthorized, ()));
            }
        };

        log::debug!("认证成功: user_id={}, is_owner={}", user_id, claims.is_owner);

        Outcome::Success(AuthGuard {
            user_id,
            is_owner: claims.is_owner,
        })
    }
}


/// 可选认证守卫 - 如果有 JWT token 就验证，没有就返回 None
#[derive(Debug, Clone)]
pub struct OptionalAuthGuard {
    pub user_id: Option<ObjectId>,
    pub is_owner: bool,
}

#[rocket::async_trait]
impl<'r> FromRequest<'r> for OptionalAuthGuard {
    type Error = ();

    async fn from_request(req: &'r Request<'_>) -> Outcome<Self, Self::Error> {
        // 1. 尝试从 Authorization header 获取 JWT token
        let token = match req.headers().get_one("Authorization") {
            Some(auth) => {
                if auth.starts_with("Bearer ") {
                    Some(&auth[7..])
                } else {
                    None
                }
            }
            None => None,
        };

        // 如果没有 token，返回空的认证信息
        let token = match token {
            Some(t) => t,
            None => {
                return Outcome::Success(OptionalAuthGuard {
                    user_id: None,
                    is_owner: false,
                });
            }
        };

        // 2. 获取配置
        let config = match req.guard::<&State<OAuthConfig>>().await {
            Outcome::Success(config) => config,
            _ => {
                return Outcome::Success(OptionalAuthGuard {
                    user_id: None,
                    is_owner: false,
                });
            }
        };

        // 3. 验证 JWT token
        let claims = match verify_jwt(token, &config.jwt_secret) {
            Ok(claims) => claims,
            Err(_) => {
                return Outcome::Success(OptionalAuthGuard {
                    user_id: None,
                    is_owner: false,
                });
            }
        };

        // 4. 检查 token 是否过期
        if claims.is_expired() {
            return Outcome::Success(OptionalAuthGuard {
                user_id: None,
                is_owner: false,
            });
        }

        // 5. 解析 user_id
        let user_id = match claims.user_id() {
            Ok(id) => Some(id),
            Err(_) => None,
        };

        Outcome::Success(OptionalAuthGuard {
            user_id,
            is_owner: claims.is_owner,
        })
    }
}
