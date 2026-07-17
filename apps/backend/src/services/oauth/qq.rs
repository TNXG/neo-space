//! QQ OAuth provider methods

use bson::doc;

use crate::error::AppError;
use crate::models::{Account, Reader};
use crate::services::helpers::is_owner_user_id;

use super::OAuthService;
use super::OAuthUserInfo;

impl OAuthService {
    /// 生成 QQ 中转登录地址；回调始终使用 `options.url.serverUrl`。
    pub fn qq_authorize_url(&self, state: &str) -> Result<String, AppError> {
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
        Ok(format!(
            "https://api-space.tnxg.top/oauth/qq/authorize?redirect=true&return_url={}",
            urlencoding::encode(&redirect_uri)
        ))
    }

    /// 通过中转服务交换 QQ 授权码，不读取 App ID / App Key。
    pub async fn exchange_qq_code(&self, code: &str) -> Result<OAuthUserInfo, AppError> {
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
