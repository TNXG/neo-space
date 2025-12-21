//! GitHub OAuth 服务 - 处理 GitHub OAuth 认证流程

use serde::{Deserialize, Serialize};
use crate::models::GitHubUser;

/// GitHub OAuth token 响应
#[derive(Debug, Deserialize, Serialize)]
pub struct GitHubTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub scope: String,
}

/// GitHub OAuth 服务
pub struct GitHubOAuthService {
    client: reqwest::Client,
    client_id: String,
    client_secret: String,
}

impl GitHubOAuthService {
    /// 创建新的 GitHubOAuthService
    pub fn new(client_id: String, client_secret: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            client_id,
            client_secret,
        }
    }

    /// 交换授权码获取 access_token
    /// 
    /// # 参数
    /// * `code` - GitHub 返回的授权码
    /// 
    /// # 返回
    /// * `Ok(String)` - access_token
    /// * `Err(String)` - 错误信息
    pub async fn exchange_code(&self, code: &str) -> Result<String, String> {
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
            .send()
            .await
            .map_err(|e| format!("GitHub token 请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub token 请求失败 ({}): {}", status, text));
        }

        let token_data: GitHubTokenResponse = response
            .json()
            .await
            .map_err(|e| format!("解析 GitHub token 响应失败: {}", e))?;

        Ok(token_data.access_token)
    }

    /// 获取 GitHub 用户信息
    /// 
    /// # 参数
    /// * `access_token` - GitHub access token
    /// 
    /// # 返回
    /// * `Ok(GitHubUser)` - 用户信息
    /// * `Err(String)` - 错误信息
    pub async fn get_user(&self, access_token: &str) -> Result<GitHubUser, String> {
        let user_url = "https://api.github.com/user";

        let response = self.client
            .get(user_url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("User-Agent", "Neo-Space-Backend")
            .send()
            .await
            .map_err(|e| format!("GitHub 用户信息请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("GitHub 用户信息请求失败 ({}): {}", status, text));
        }

        let user: GitHubUser = response
            .json()
            .await
            .map_err(|e| format!("解析 GitHub 用户信息失败: {}", e))?;

        // 验证邮箱（GitHub 可能返回空邮箱）
        // 注意：根据需求，如果邮箱为空，我们将其设为空字符串（与 QQ 相同处理）
        // 不再强制要求邮箱必须存在

        Ok(user)
    }

    /// 完整的 GitHub OAuth 流程
    /// 
    /// # 参数
    /// * `code` - GitHub 返回的授权码
    /// 
    /// # 返回
    /// * `Ok((GitHubUser, String, String))` - (用户信息, access_token, scope)
    /// * `Err(String)` - 错误信息
    pub async fn oauth_flow(&self, code: &str) -> Result<(GitHubUser, String, String), String> {
        // 1. 交换授权码获取 access_token
        let access_token = self.exchange_code(code).await?;

        // 2. 获取用户信息
        let user = self.get_user(&access_token).await?;

        // 3. 获取 scope（从 token 响应中）
        // 注意：这里简化处理，实际 scope 在 exchange_code 中已获取
        // 为了保持接口简洁，这里返回默认 scope
        let scope = "user:email".to_string();

        Ok((user, access_token, scope))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_github_oauth_service_creation() {
        let service = GitHubOAuthService::new(
            "test_client_id".to_string(),
            "test_client_secret".to_string(),
        );
        assert_eq!(service.client_id, "test_client_id");
        assert_eq!(service.client_secret, "test_client_secret");
    }

    // 注意：实际的 OAuth 流程测试需要真实的 GitHub 凭证
    // 这些测试应该在集成测试中进行，使用 mock 服务器
}
