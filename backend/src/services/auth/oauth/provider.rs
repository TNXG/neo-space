//! OAuth Provider trait 定义
//!
//! 定义统一的 OAuth 提供商接口

use async_trait::async_trait;

/// OAuth 提供商类型
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OAuthProviderType {
    GitHub,
    QQ,
}

/// OAuth 提供商 trait
///
/// 所有 OAuth 提供商都必须实现此 trait
/// 仅供模块内部使用
#[async_trait]
pub(super) trait OAuthProvider: Send + Sync {
    /// 使用授权码换取用户信息
    ///
    /// # 参数
    /// * `code` - OAuth 授权码
    ///
    /// # 返回
    /// * `Ok(OAuthUserInfo)` - 用户信息
    /// * `Err(String)` - 错误信息
    async fn exchange_code_for_user(&self, code: &str) -> Result<OAuthUserInfo, String>;
}

/// OAuth 用户信息统一格式
#[derive(Debug, Clone)]
pub struct OAuthUserInfo {
    /// OAuth 提供商类型
    pub provider: OAuthProviderType,
    /// 提供商的用户 ID
    pub provider_user_id: String,
    /// 用户昵称
    pub nickname: String,
    /// 用户头像
    pub avatar: String,
    /// 用户邮箱（可能为空）
    pub email: Option<String>,
    /// 访问令牌（GitHub 返回，QQ 可能为空）
    pub access_token: Option<String>,
}
