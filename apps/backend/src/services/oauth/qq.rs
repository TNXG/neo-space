//! QQ OAuth provider methods

use bson::doc;

use crate::error::AppError;
use crate::models::{Account, Reader};
use crate::services::helpers::is_owner_user_id;

use super::OAuthService;
use super::OAuthUserInfo;

impl OAuthService {
    /// Rocket 时期的 QQ 登录依赖外部中转服务，而不是本地直连 QQ OAuth。
    /// Axum 迁移后改成了仅支持本地凭证直连，导致旧部署在未配置
    /// `QQ_APP_ID/QQ_APP_KEY` 时直接报错。
    ///
    /// 这里保留新实现，同时在本地凭证缺失时自动回退到旧的中转服务。
    fn qq_proxy_authorize_url(&self, state: &str) -> String {
        // 中转服务不会原样回传 state，因此把 state 直接拼进 return_url，
        // 让最终落到本地 callback 时仍然能拿到 ?state=...。
        let redirect_uri = if state.is_empty() {
            format!("{}/api/auth/oauth/qq/callback", self.backend_url.as_str())
        } else {
            format!(
                "{}/api/auth/oauth/qq/callback?state={}",
                self.backend_url.as_str(),
                urlencoding::encode(state),
            )
        };
        format!(
            "https://api-space.tnxg.top/oauth/qq/authorize?redirect=true&return_url={}",
            urlencoding::encode(&redirect_uri)
        )
    }

    /// Get QQ OAuth client credentials
    pub fn qq_app_id(&self) -> &str {
        &self.qq_app_id
    }

    /// Generate QQ OAuth authorization URL
    pub fn qq_authorize_url(&self, state: &str) -> Result<String, AppError> {
        let app_id = self.qq_app_id.as_str();
        if app_id.is_empty() {
            return Ok(self.qq_proxy_authorize_url(state));
        }
        let redirect_uri = format!("{}/api/auth/oauth/qq/callback", self.backend_url.as_str());
        Ok(format!(
            "https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id={}&redirect_uri={}&scope=get_user_info&state={}",
            app_id,
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(state),
        ))
    }

    /// Exchange QQ OAuth code for user info
    pub async fn exchange_qq_code(&self, code: &str) -> Result<OAuthUserInfo, AppError> {
        let app_id = self.qq_app_id.as_str();
        let app_key = self.qq_app_key.as_str();

        if app_id.is_empty() || app_key.is_empty() {
            return self.exchange_qq_code_via_proxy(code).await;
        }

        let redirect_uri = format!("{}/api/auth/oauth/qq/callback", self.backend_url.as_str());

        // Step 1: Get access token
        let token_url = format!(
            "https://graph.qq.com/oauth2.0/token?grant_type=authorization_code&client_id={}&client_secret={}&code={}&redirect_uri={}",
            app_id,
            app_key,
            code,
            urlencoding::encode(&redirect_uri)
        );

        let token_resp = self
            .http_client
            .get(&token_url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("QQ token request failed: {}", e)))?;

        let token_text = token_resp
            .text()
            .await
            .map_err(|e| AppError::Internal(format!("QQ token response read failed: {}", e)))?;

        // Parse access_token=xxx&expires_in=xxx&refresh_token=xxx
        let access_token = token_text
            .split('&')
            .find(|part| part.starts_with("access_token="))
            .and_then(|part| part.split('=').nth(1))
            .ok_or_else(|| {
                AppError::Internal("QQ token response missing access_token".to_string())
            })?
            .to_string();

        // Step 2: Get OpenID
        let openid_url = format!(
            "https://graph.qq.com/oauth2.0/me?access_token={}",
            access_token
        );

        let openid_resp = self
            .http_client
            .get(&openid_url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("QQ openid request failed: {}", e)))?;

        let openid_text = openid_resp
            .text()
            .await
            .map_err(|e| AppError::Internal(format!("QQ openid response read failed: {}", e)))?;

        // Response format: callback( {"client_id":"xxx","openid":"xxx"} );
        let openid_json_str = openid_text
            .trim()
            .trim_start_matches("callback(")
            .trim_end_matches(");")
            .trim();

        let openid_json: serde_json::Value = serde_json::from_str(openid_json_str)
            .map_err(|e| AppError::Internal(format!("Failed to parse QQ openid: {}", e)))?;

        let openid = openid_json
            .get("openid")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Internal("QQ openid missing".to_string()))?
            .to_string();

        // Step 3: Get user info
        let user_info_url = format!(
            "https://graph.qq.com/user/get_user_info?access_token={}&oauth_consumer_key={}&openid={}",
            access_token, app_id, openid
        );

        let user_resp = self
            .http_client
            .get(&user_info_url)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("QQ user info request failed: {}", e)))?;

        let user_json: serde_json::Value = user_resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse QQ user info: {}", e)))?;

        let nickname = user_json
            .get("nickname")
            .and_then(|v| v.as_str())
            .unwrap_or("QQ User")
            .to_string();
        let avatar = user_json
            .get("figureurl_qq_2")
            .and_then(|v| v.as_str())
            .or_else(|| user_json.get("figureurl_qq_1").and_then(|v| v.as_str()))
            .unwrap_or("")
            .to_string();

        Ok(OAuthUserInfo {
            provider: "qq".to_string(),
            provider_user_id: openid,
            nickname,
            avatar,
            email: None,
            access_token: Some(access_token),
        })
    }

    async fn exchange_qq_code_via_proxy(&self, code: &str) -> Result<OAuthUserInfo, AppError> {
        let user_url = format!("https://api-space.tnxg.top/user/get?code={code}");

        let response = self
            .http_client
            .get(&user_url)
            .send()
            .await
            .map_err(|error| AppError::Internal(format!("QQ proxy request failed: {error}")))?;

        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "QQ proxy request failed ({status}): {text}"
            )));
        }

        let proxy_response: serde_json::Value = response.json().await.map_err(|error| {
            AppError::Internal(format!("Failed to parse QQ proxy response: {error}"))
        })?;

        let status = proxy_response
            .get("status")
            .and_then(|value| value.as_str())
            .unwrap_or_default();

        if status != "success" {
            let message = proxy_response
                .get("message")
                .and_then(|value| value.as_str())
                .unwrap_or("QQ proxy login failed");
            return Err(AppError::Internal(message.to_string()));
        }

        let user_data = proxy_response
            .get("data")
            .ok_or_else(|| AppError::Internal("QQ proxy response missing user data".to_string()))?;

        let openid = user_data
            .get("qq_openid")
            .and_then(|value| value.as_str())
            .ok_or_else(|| AppError::Internal("QQ proxy response missing qq_openid".to_string()))?
            .to_string();

        let nickname = user_data
            .get("nickname")
            .and_then(|value| value.as_str())
            .unwrap_or("QQ User")
            .to_string();

        let avatar = user_data
            .get("avatar")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string();

        Ok(OAuthUserInfo {
            provider: "qq".to_string(),
            provider_user_id: openid,
            nickname,
            avatar,
            email: None,
            access_token: None,
        })
    }

    /// Process QQ OAuth login (same logic as GitHub but for QQ provider)
    pub async fn process_qq_oauth_login(
        &self,
        user_info: OAuthUserInfo,
    ) -> Result<(String, bool, bool), AppError> {
        let readers_collection = self.db.collection::<Reader>("readers");
        let accounts_collection = self.db.collection::<Account>("accounts");

        let filter = doc! {
            "provider": "qq",
            "accountId": &user_info.provider_user_id
        };

        let existing_account = accounts_collection
            .find_one(filter)
            .await
            .map_err(|e| AppError::Database(format!("Failed to find account: {}", e)))?;

        if let Some(account) = existing_account {
            let user_id = account.user_id.to_hex();
            let reader = readers_collection
                .find_one(doc! { "_id": account.user_id })
                .await
                .map_err(|e| AppError::Database(format!("Failed to find reader: {}", e)))?;
            let is_owner = match is_owner_user_id(&self.db, account.user_id).await {
                Ok(value) => value,
                Err(error) => {
                    tracing::warn!("Failed to resolve QQ owner status: {}", error);
                    reader.is_some_and(|r| r.is_owner)
                }
            };
            Ok((user_id, is_owner, false))
        } else {
            let user_id = bson::oid::ObjectId::new();
            let nickname = user_info.nickname.clone();
            let avatar = user_info.avatar.clone();
            let openid = user_info.provider_user_id.clone();
            let access_token = user_info.access_token.clone().unwrap_or_default();

            let handle = Reader::generate_handle(&nickname);
            let new_reader = Reader {
                id: user_id,
                email: format!("{}@qq.oauth", openid),
                name: nickname.clone(),
                handle: handle.clone(),
                image: avatar.clone(),
                is_owner: false,
                email_verified: Some(false),
                created_at: bson::DateTime::now(),
                updated_at: bson::DateTime::now(),
            };

            readers_collection
                .insert_one(&new_reader)
                .await
                .map_err(|e| AppError::Database(format!("Failed to create reader: {}", e)))?;

            let profile = crate::models::account::OAuthUserProfile {
                name: nickname,
                email: None,
                avatar,
                handle,
            };
            let new_account = Account::new_qq_with_info(user_id, openid, access_token, profile);

            accounts_collection
                .insert_one(&new_account)
                .await
                .map_err(|e| AppError::Database(format!("Failed to create account: {}", e)))?;

            tracing::info!("Created new user via QQ OAuth: {}", user_id.to_hex());
            Ok((user_id.to_hex(), false, true))
        }
    }
}
