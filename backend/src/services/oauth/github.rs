//! GitHub OAuth provider methods

use bson::doc;
use serde::Deserialize;

use crate::error::AppError;
use crate::models::{Account, Reader};

use super::OAuthService;
use super::OAuthUserInfo;

/// GitHub OAuth token response
#[derive(Debug, Deserialize)]
struct GitHubTokenResponse {
    access_token: String,
    #[allow(dead_code)]
    token_type: String,
    #[allow(dead_code)]
    scope: String,
}

impl OAuthService {
    /// Get GitHub client ID
    pub fn github_client_id(&self) -> String {
        self.github_client_id.clone()
    }

    /// Get GitHub client secret
    pub fn github_client_secret(&self) -> String {
        self.github_client_secret.clone()
    }

    /// Generate GitHub OAuth authorization URL
    pub fn github_authorize_url(&self) -> Result<String, AppError> {
        let client_id = self.github_client_id();

        if client_id.is_empty() {
            return Err(AppError::Internal(
                "GitHub OAuth not configured".to_string(),
            ));
        }

        let redirect_uri = format!("{}/api/auth/oauth/github/callback", self.backend_url);

        Ok(format!(
            "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=user:email",
            client_id,
            urlencoding::encode(&redirect_uri)
        ))
    }

    /// Exchange GitHub authorization code for user info
    pub async fn exchange_github_code(&self, code: &str) -> Result<OAuthUserInfo, AppError> {
        let client_id = self.github_client_id();
        let client_secret = self.github_client_secret();

        if client_id.is_empty() || client_secret.is_empty() {
            return Err(AppError::Internal(
                "GitHub OAuth not configured".to_string(),
            ));
        }

        // 1. Exchange code for access token
        let token_url = "https://github.com/login/oauth/access_token";

        let json_body = serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
        });

        let token_response = self
            .http_client
            .post(token_url)
            .json(&json_body)
            .header("Accept", "application/json")
            .header("User-Agent", "Neo-Space-Bot/1.0")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub token request failed: {}", e)))?;

        if !token_response.status().is_success() {
            let status = token_response.status();
            let text = token_response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub token request failed ({}): {}",
                status, text
            )));
        }

        let token_data: GitHubTokenResponse = token_response.json().await.map_err(|e| {
            AppError::Internal(format!("Failed to parse GitHub token response: {}", e))
        })?;

        // 2. Get user info
        let user_url = "https://api.github.com/user";

        let user_response = self
            .http_client
            .get(user_url)
            .header(
                "Authorization",
                format!("Bearer {}", token_data.access_token),
            )
            .header("User-Agent", "Neo-Space-Bot/1.0")
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("GitHub user info request failed: {}", e)))?;

        if !user_response.status().is_success() {
            let status = user_response.status();
            let text = user_response.text().await.unwrap_or_default();
            return Err(AppError::Internal(format!(
                "GitHub user info request failed ({}): {}",
                status, text
            )));
        }

        let user: crate::models::GitHubUser = user_response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse GitHub user info: {}", e)))?;

        Ok(OAuthUserInfo {
            provider: "github".to_string(),
            provider_user_id: user.id.to_string(),
            nickname: user.login.clone(),
            avatar: user.avatar_url,
            email: user.email,
            access_token: Some(token_data.access_token),
        })
    }

    /// Process GitHub OAuth login - create or link user account
    pub async fn process_oauth_login(
        &self,
        user_info: OAuthUserInfo,
    ) -> Result<(String, bool, bool), AppError> {
        let readers_collection = self.db.collection::<Reader>("readers");
        let accounts_collection = self.db.collection::<Account>("accounts");

        let filter = doc! {
            "provider": "github",
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

            let is_owner = reader.is_some_and(|r| r.is_owner);

            Ok((user_id, is_owner, false))
        } else {
            let user_id = bson::oid::ObjectId::new();

            let nickname = user_info.nickname.clone();
            let avatar = user_info.avatar.clone();
            let email = user_info.email.clone();
            let provider_user_id = user_info.provider_user_id.clone();
            let access_token = user_info.access_token.clone();

            let new_reader = Reader {
                id: user_id,
                email: email
                    .clone()
                    .unwrap_or_else(|| format!("{}@github.local", nickname)),
                name: nickname.clone(),
                handle: Reader::generate_handle(&nickname),
                image: avatar.clone(),
                is_owner: false,
                email_verified: email.is_some().then_some(true),
                created_at: bson::DateTime::now(),
                updated_at: bson::DateTime::now(),
            };

            readers_collection
                .insert_one(&new_reader)
                .await
                .map_err(|e| AppError::Database(format!("Failed to create reader: {}", e)))?;

            let handle = Reader::generate_handle(&nickname);

            let profile = crate::models::account::OAuthUserProfile {
                name: nickname,
                email,
                avatar,
                handle,
            };
            let new_account = Account::new_github_with_info(
                user_id,
                provider_user_id.parse().unwrap_or(0),
                access_token.unwrap_or_default(),
                None,
                profile,
            );

            accounts_collection
                .insert_one(&new_account)
                .await
                .map_err(|e| AppError::Database(format!("Failed to create account: {}", e)))?;

            tracing::info!("Created new user via GitHub OAuth: {}", user_id.to_hex());

            Ok((user_id.to_hex(), false, true))
        }
    }
}
