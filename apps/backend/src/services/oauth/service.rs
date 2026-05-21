//! OAuth service - core struct and common methods

use bson::doc;
use mongodb::Database;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::AppError;
use crate::models::Reader;

/// OAuth user info from providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthUserInfo {
    pub provider: String,
    pub provider_user_id: String,
    pub nickname: String,
    pub avatar: String,
    pub email: Option<String>,
    pub access_token: Option<String>,
}

/// OAuth service
pub struct OAuthService {
    pub(crate) db: Database,
    pub(crate) http_client: Arc<reqwest::Client>,
    pub(crate) github_client_id: String,
    pub(crate) github_client_secret: String,
    pub(crate) backend_url: String,
    pub(crate) qq_app_id: String,
    pub(crate) qq_app_key: String,
}

impl OAuthService {
    /// Create a new OAuth service
    pub fn new(
        db: Database,
        http_client: Arc<reqwest::Client>,
        github_client_id: String,
        github_client_secret: String,
        backend_url: String,
        qq_app_id: String,
        qq_app_key: String,
    ) -> Self {
        Self {
            db,
            http_client,
            github_client_id,
            github_client_secret,
            backend_url,
            qq_app_id,
            qq_app_key,
        }
    }

    /// Get current user info
    pub async fn get_current_user(&self, user_id: &str) -> Result<Reader, AppError> {
        let object_id = bson::oid::ObjectId::parse_str(user_id)
            .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;

        let collection = self.db.collection::<Reader>("readers");

        collection
            .find_one(doc! { "_id": object_id })
            .await
            .map_err(|e| AppError::Database(format!("Failed to find user: {}", e)))?
            .ok_or_else(|| AppError::NotFound("User not found".to_string()))
    }
}
