//! OAuth 统一服务
//!
//! 提供统一的 OAuth 服务入口，管理多个 OAuth 提供商

use super::{github::GitHubOAuthProvider, provider::OAuthProvider, qq::QQOAuthProvider};

/// OAuth 统一服务
pub struct OAuthService {
    github: Option<GitHubOAuthProvider>,
    qq: Option<QQOAuthProvider>,
}

impl OAuthService {
    /// 创建新的 OAuth 服务
    ///
    /// # 参数
    /// * `github_client_id` - GitHub Client ID（可选）
    /// * `github_client_secret` - GitHub Client Secret（可选）
    /// * `qq_redirect_uri` - QQ 回调 URL（可选）
    pub fn new(
        github_client_id: Option<String>,
        github_client_secret: Option<String>,
        qq_redirect_uri: Option<String>,
    ) -> Self {
        let github = if let (Some(client_id), Some(client_secret)) =
            (github_client_id, github_client_secret)
        {
            Some(GitHubOAuthProvider::new(client_id, client_secret))
        } else {
            None
        };

        let qq = qq_redirect_uri.map(QQOAuthProvider::new);

        Self { github, qq }
    }

    /// 使用授权码交换用户信息（GitHub）
    pub async fn exchange_github_code(
        &self,
        code: &str,
    ) -> Result<super::provider::OAuthUserInfo, String> {
        let provider = self
            .github
            .as_ref()
            .ok_or_else(|| "GitHub OAuth 未配置".to_string())?;
        provider.exchange_code_for_user(code).await
    }

    /// 使用授权码交换用户信息（QQ）
    pub async fn exchange_qq_code(
        &self,
        code: &str,
    ) -> Result<super::provider::OAuthUserInfo, String> {
        let provider = self
            .qq
            .as_ref()
            .ok_or_else(|| "QQ OAuth 未配置".to_string())?;
        provider.exchange_code_for_user(code).await
    }

    /// 获取 QQ 授权 URL
    pub fn get_qq_authorize_url(&self) -> Result<String, String> {
        self.qq
            .as_ref()
            .map(|p| p.get_authorize_url())
            .ok_or_else(|| "QQ OAuth 未配置".to_string())
    }
}
