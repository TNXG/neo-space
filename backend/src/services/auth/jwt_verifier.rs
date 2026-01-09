//! JWT 验证服务
//!
//! 提供独立的 JWT 验证功能，解耦 Guards 与配置的依赖

use crate::utils::jwt::{verify_jwt, JwtClaims, JwtError};
use rocket::http::Status;

/// JWT 验证服务
#[derive(Clone, Debug)]
pub struct JWTVerifier {
    secret: String,
}

impl JWTVerifier {
    /// 创建新的 JWT 验证服务
    pub fn new(secret: String) -> Self {
        Self { secret }
    }

    /// 验证 JWT token 并返回 Claims
    ///
    /// # 参数
    /// * `token` - JWT token 字符串
    ///
    /// # 返回
    /// * `Ok(JwtClaims)` - 验证成功，返回声明信息
    /// * `Err(JwtError)` - 验证失败
    pub fn verify(&self, token: &str) -> Result<JwtClaims, JwtError> {
        verify_jwt(token, &self.secret)
    }

    /// 验证 JWT token（用于 Guards）
    ///
    /// # 参数
    /// * `token` - JWT token 字符串
    ///
    /// # 返回
    /// * `Ok(JwtClaims)` - 验证成功且未过期
    /// * `Err(Status)` - 验证失败或已过期
    pub fn verify_for_guard(&self, token: &str) -> Result<JwtClaims, Status> {
        // 1. 验证 JWT 签名和格式
        let claims = self.verify(token).map_err(|e| {
            log::warn!("JWT 验证失败: {e:?}");
            Status::Unauthorized
        })?;

        // 2. 检查 token 是否过期
        if claims.is_expired() {
            log::warn!("JWT token 已过期");
            return Err(Status::Unauthorized);
        }

        Ok(claims)
    }

    /// 获取 secret（用于测试）
    #[cfg(test)]
    pub fn secret(&self) -> &str {
        &self.secret
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jwt_verifier_creation() {
        let verifier = JWTVerifier::new("test_secret".to_string());
        assert_eq!(verifier.secret(), "test_secret");
    }

    #[test]
    fn test_jwt_verifier_invalid_token() {
        let verifier = JWTVerifier::new("test_secret".to_string());
        let result = verifier.verify("invalid_token");
        assert!(result.is_err());
    }
}
