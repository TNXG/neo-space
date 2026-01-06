//! GitHub OAuth 提供商实现

use crate::models::GitHubUser;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use super::{OAuthProviderType, OAuthUserInfo};
use super::provider::OAuthProvider;

/// GitHub OAuth token 响应
#[derive(Debug, Deserialize, Serialize)]
struct GitHubTokenResponse {
    access_token: String,
    #[allow(dead_code)]
    token_type: String,
    #[allow(dead_code)]
    scope: String,
}

/// GitHub OAuth 提供商
pub struct GitHubOAuthProvider {
    client: reqwest::Client,
    client_id: String,
    client_secret: String,
}

impl GitHubOAuthProvider {
    /// 创建新的 GitHub OAuth 提供商
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            client_id,
            client_secret,
        }
    }

    /// 交换授权码获取 access_token
    async fn exchange_code(&self, code: &str) -> Result<String, String> {
        let token_url = "https://github.com/login/oauth/access_token";

        let params = [
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
            ("code", code),
        ];

        let response = self.client
            .post(token_url)
            .form(&params)
            .header("Accept", "application/json")
            .header("User-Agent", "Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0; +mailto:tnxg@outlook.jp; ) AppleWebKit/99 (KHTML, like Gecko) Chrome/99 MyGO/5 (KiraKira/DokiDoki; Bananice/Protected) Giraffe/4.11 (Wakarimasu/; Haruhikage/Stop)")
            .send()
            .await
            .map_err(|e| format!("GitHub token 请求失败: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub token 请求失败 ({status}): {text}"));
        }

        let token_data: GitHubTokenResponse = response
            .json()
            .await
            .map_err(|e| format!("解析 GitHub token 响应失败: {e}"))?;

        Ok(token_data.access_token)
    }

    /// 获取 GitHub 用户信息
    async fn get_user(&self, access_token: &str) -> Result<GitHubUser, String> {
        let user_url = "https://api.github.com/user";

        let response = self.client
            .get(user_url)
            .header("Authorization", format!("Bearer {access_token}"))
            .header("User-Agent", "Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0; +mailto:tnxg@outlook.jp; ) AppleWebKit/99 (KHTML, like Gecko) Chrome/99 MyGO/5 (KiraKira/DokiDoki; Bananice/Protected) Giraffe/4.11 (Wakarimasu/; Haruhikage/Stop)")
            .send()
            .await
            .map_err(|e| format!("GitHub 用户信息请求失败: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub 用户信息请求失败 ({status}): {text}"));
        }

        let user: GitHubUser = response
            .json()
            .await
            .map_err(|e| format!("解析 GitHub 用户信息失败: {e}"))?;

        Ok(user)
    }
}

#[async_trait]
impl OAuthProvider for GitHubOAuthProvider {
    /// 使用授权码换取用户信息
    async fn exchange_code_for_user(&self, code: &str) -> Result<OAuthUserInfo, String> {
        // 1. 交换授权码获取 access_token
        let access_token = self.exchange_code(code).await?;

        // 2. 获取用户信息
        let user = self.get_user(&access_token).await?;

        // 3. 转换为统一的用户信息格式
        Ok(OAuthUserInfo {
            provider: OAuthProviderType::GitHub,
            provider_user_id: user.id.to_string(),
            nickname: user.login,
            avatar: user.avatar_url,
            email: user.email,
            access_token: Some(access_token),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_oauth_provider_creation() {
        let provider = GitHubOAuthProvider::new(
            "test_client_id".to_string(),
            "test_client_secret".to_string(),
        );
        // Just verify the provider can be created
        assert_eq!(provider.client_id, "test_client_id");
    }
}
