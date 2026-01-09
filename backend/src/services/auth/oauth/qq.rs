//! QQ OAuth 提供商实现

use super::provider::OAuthProvider;
use super::{OAuthProviderType, OAuthUserInfo};
use async_trait::async_trait;
use serde::Deserialize;

/// 第三方 API 响应结构
#[derive(Debug, Deserialize)]
struct ApiResponse {
    status: String,
    message: Option<String>,
    data: Option<QQUserInfoResponse>,
}

/// QQ 用户信息响应（从第三方 API）
#[derive(Debug, Deserialize)]
struct QQUserInfoResponse {
    #[allow(dead_code)]
    user_id: String,
    qq_openid: String,
    nickname: String,
    avatar: String,
    #[allow(dead_code)]
    gender: Option<String>,
}

/// QQ OAuth 提供商
pub struct QQOAuthProvider {
    client: reqwest::Client,
    redirect_uri: String,
}

impl QQOAuthProvider {
    /// 创建新的 QQ OAuth 提供商
    pub fn new(redirect_uri: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            redirect_uri,
        }
    }

    /// 生成 QQ OAuth 授权 URL
    pub fn get_authorize_url(&self) -> String {
        format!(
            "https://api-space.tnxg.top/oauth/qq/authorize?redirect=true&return_url={}",
            urlencoding::encode(&self.redirect_uri)
        )
    }

    /// 使用授权码获取 QQ 用户信息
    async fn get_user_info_with_code(
        &self,
        code: &str,
    ) -> Result<(QQUserInfoResponse, String), String> {
        let user_url = format!("https://api-space.tnxg.top/user/get?code={code}");

        let response = self
            .client
            .get(&user_url)
            .send()
            .await
            .map_err(|e| format!("QQ 用户信息请求失败: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("QQ 用户信息请求失败 ({status}): {text}"));
        }

        let api_response: ApiResponse = response
            .json()
            .await
            .map_err(|e| format!("解析 QQ 用户信息响应失败: {e}"))?;

        if api_response.status != "success" {
            let msg = api_response
                .message
                .unwrap_or_else(|| "获取用户信息失败".to_string());
            return Err(msg);
        }

        let user_data = api_response.data.ok_or("响应中缺少用户数据")?;
        let openid = user_data.qq_openid.clone();

        Ok((user_data, openid))
    }
}

#[async_trait]
impl OAuthProvider for QQOAuthProvider {
    /// 使用授权码换取用户信息
    async fn exchange_code_for_user(&self, code: &str) -> Result<OAuthUserInfo, String> {
        let (user_data, openid) = self.get_user_info_with_code(code).await?;

        Ok(OAuthUserInfo {
            provider: OAuthProviderType::QQ,
            provider_user_id: openid.clone(),
            nickname: user_data.nickname,
            avatar: user_data.avatar,
            email: None,        // QQ 不提供邮箱
            access_token: None, // QQ 使用 code 而非 access_token
        })
    }
}
