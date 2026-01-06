pub mod avatar;
pub mod identity;
pub mod jwt_verifier;
pub mod oauth;

// 导出 JWT 验证服务
pub use jwt_verifier::JWTVerifier;