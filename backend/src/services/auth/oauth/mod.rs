//! OAuth 统一服务模块
//!
//! 统一处理 GitHub、QQ 等 OAuth 提供商

pub mod github;
pub mod provider;
pub mod qq;
pub mod service;

// 导出供外部使用的类型
pub use provider::{OAuthProviderType, OAuthUserInfo};
pub use service::OAuthService;
