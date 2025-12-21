//! QQ OAuth 服务 - 通过第三方 API 处理 QQ OAuth 认证流程
//! 使用 https://api-space.tnxg.top 作为 OAuth 代理

use serde::Deserialize;
use crate::models::QQUser;

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
    #[allow(unused)]
    user_id: String,
    qq_openid: String,
    nickname: String,
    avatar: String,
    #[allow(unused)]
    gender: Option<String>,
}

/// QQ OAuth 服务
pub struct QQOAuthService {
    client: reqwest::Client,
    redirect_uri: String,
}

impl QQOAuthService {
    /// 创建新的 QQOAuthService
    /// 
    /// # 参数
    /// * `redirect_uri` - 回调 URL
    pub fn new(redirect_uri: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            redirect_uri,
        }
    }

    /// 生成 QQ OAuth 授权 URL
    /// 
    /// # 返回
    /// * 授权 URL
    pub fn get_authorize_url(&self) -> String {
        format!(
            "https://api-space.tnxg.top/oauth/qq/authorize?redirect=true&return_url={}",
            urlencoding::encode(&self.redirect_uri)
        )
    }

    /// 使用授权码获取 QQ 用户信息
    /// 
    /// # 参数
    /// * `code` - 第三方 API 返回的授权码
    /// 
    /// # 返回
    /// * `Ok((QQUser, String))` - (用户信息, openid)
    /// * `Err(String)` - 错误信息
    pub async fn get_user_info_with_code(&self, code: &str) -> Result<(QQUser, String), String> {
        let user_url = format!("https://api-space.tnxg.top/user/get?code={}", code);

        let response = self.client
            .get(&user_url)
            .send()
            .await
            .map_err(|e| format!("QQ 用户信息请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(format!("QQ 用户信息请求失败 ({}): {}", status, text));
        }

        let api_response: ApiResponse = response
            .json()
            .await
            .map_err(|e| format!("解析 QQ 用户信息响应失败: {}", e))?;

        if api_response.status != "success" {
            let msg = api_response.message.unwrap_or_else(|| "获取用户信息失败".to_string());
            return Err(msg);
        }

        let user_data = api_response.data.ok_or("响应中缺少用户数据")?;

        // 转换为 QQUser 格式
        let qq_user = QQUser {
            nickname: user_data.nickname,
            figureurl_qq_1: user_data.avatar.clone(),
            figureurl_qq_2: Some(user_data.avatar),
        };

        Ok((qq_user, user_data.qq_openid))
    }

    /// 完整的 QQ OAuth 流程（简化版，使用第三方 API）
    /// 
    /// # 参数
    /// * `code` - 第三方 API 返回的授权码
    /// 
    /// # 返回
    /// * `Ok((QQUser, String, String))` - (用户信息, openid, code)
    /// * `Err(String)` - 错误信息
    pub async fn oauth_flow(&self, code: &str) -> Result<(QQUser, String, String), String> {
        let (qq_user, openid) = self.get_user_info_with_code(code).await?;
        
        // 返回 code 作为 access_token（第三方 API 不返回真实的 access_token）
        Ok((qq_user, openid, code.to_string()))
    }
}