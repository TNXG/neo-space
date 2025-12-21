//! Options Repository - 从数据库读取配置选项

use mongodb::{Database, bson::doc};
use serde::{Deserialize, Serialize};

/// OAuth 配置选项（存储在数据库中）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OAuthOptions {
    pub github_client_id: Option<String>,
    pub github_client_secret: Option<String>,
}

/// 数据库中 OAuth 配置的结构
#[derive(Debug, Deserialize)]
struct OAuthDocument {
    #[allow(unused)]
    name: String,
    value: OAuthValue,
}

#[derive(Debug, Deserialize)]
struct OAuthValue {
    #[serde(default)]
    providers: Vec<OAuthProvider>,
    #[serde(default)]
    secrets: OAuthSecrets,
    #[serde(default)]
    public: OAuthPublic,
}

#[derive(Debug, Deserialize)]
struct OAuthProvider {
    #[serde(rename = "type")]
    provider_type: String,
    enabled: bool,
}

#[derive(Debug, Deserialize, Default)]
struct OAuthSecrets {
    #[serde(default)]
    github: Option<GitHubSecrets>,
}

#[derive(Debug, Deserialize)]
struct GitHubSecrets {
    #[serde(rename = "clientSecret")]
    client_secret: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct OAuthPublic {
    #[serde(default)]
    github: Option<GitHubPublic>,
}

#[derive(Debug, Deserialize)]
struct GitHubPublic {
    #[serde(rename = "clientId")]
    client_id: Option<String>,
}

/// Options Repository
pub struct OptionsRepository {
    db: Database,
}

impl OptionsRepository {
    /// 创建新的 OptionsRepository
    pub fn new(db: &Database) -> Self {
        Self { db: db.clone() }
    }

    /// 获取 OAuth 配置
    /// 
    /// # 返回
    /// * `Ok(OAuthOptions)` - OAuth 配置
    /// * `Err(mongodb::error::Error)` - 数据库错误
    pub async fn get_oauth_config(&self) -> Result<OAuthOptions, mongodb::error::Error> {
        let collection = self.db.collection::<OAuthDocument>("options");

        // 查询 name 为 "oauth" 的文档
        let oauth_doc = collection
            .find_one(doc! { "name": "oauth" })
            .await?;

        let mut options = OAuthOptions::default();

        if let Some(doc) = oauth_doc {
            // 检查 GitHub 是否启用
            let github_enabled = doc.value.providers
                .iter()
                .any(|p| p.provider_type == "github" && p.enabled);

            if github_enabled {
                // 提取 GitHub 配置
                if let Some(github_public) = &doc.value.public.github {
                    options.github_client_id = github_public.client_id.clone();
                }
                if let Some(github_secrets) = &doc.value.secrets.github {
                    options.github_client_secret = github_secrets.client_secret.clone();
                }
            }
        }

        log::debug!("从数据库读取 OAuth 配置: github_client_id={:?}", 
            options.github_client_id.as_ref().map(|s| format!("{}...", &s[..8.min(s.len())])));

        Ok(options)
    }
}
