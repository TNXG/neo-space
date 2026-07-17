//! 项目级 Meilisearch 向量化配置模型。

use serde::{Deserialize, Serialize};

/// 后端持久化的项目级向量配置；API Key 仅在服务端使用。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchVectorConfig {
    #[serde(default)]
    pub configured: bool,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub api_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub model: String,
    #[serde(default = "default_dimensions")]
    pub dimensions: u32,
    #[serde(default = "default_document_template_max_bytes")]
    pub document_template_max_bytes: u32,
}

impl Default for SearchVectorConfig {
    /// 返回适用于 OpenAI 兼容 Embeddings API 的默认配置。
    fn default() -> Self {
        Self {
            configured: false,
            enabled: false,
            api_url: String::new(),
            api_key: String::new(),
            model: String::new(),
            dimensions: default_dimensions(),
            document_template_max_bytes: default_document_template_max_bytes(),
        }
    }
}

/// 管理端更新项目级向量配置的请求。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSearchVectorConfig {
    pub enabled: bool,
    pub api_url: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub clear_api_key: bool,
    pub model: String,
    pub dimensions: u32,
    pub document_template_max_bytes: u32,
}

/// 管理端可见的项目级向量配置，不回传 API Key 明文。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchVectorConfigResponse {
    pub configured: bool,
    pub enabled: bool,
    pub api_url: String,
    pub has_api_key: bool,
    pub model: String,
    pub dimensions: u32,
    pub document_template_max_bytes: u32,
}

impl From<&SearchVectorConfig> for SearchVectorConfigResponse {
    /// 将服务端配置转换为隐藏密钥的管理端响应。
    fn from(config: &SearchVectorConfig) -> Self {
        Self {
            configured: config.configured,
            enabled: config.enabled,
            api_url: config.api_url.clone(),
            has_api_key: !config.api_key.is_empty(),
            model: config.model.clone(),
            dimensions: config.dimensions,
            document_template_max_bytes: config.document_template_max_bytes,
        }
    }
}

/// 返回默认向量维度。
fn default_dimensions() -> u32 {
    1024
}

/// 返回默认文档模板字节上限。
fn default_document_template_max_bytes() -> u32 {
    400
}
