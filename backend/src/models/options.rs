//! Site options models (safe for frontend exposure)
//!
//! Matches Rocket's models/options.rs structure for data consistency.

use serde::{Deserialize, Serialize};

// ============================================================================
// Raw Option Document (Internal Use Only)
// ============================================================================

/// Raw option document from MongoDB
#[derive(Debug, Deserialize)]
pub struct RawOption {
    pub name: String,
    pub value: bson::Bson,
}

// ============================================================================
// Safe Public Options (Can be exposed to frontend)
// ============================================================================

/// SEO configuration (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SeoOptions {
    /// 网站标题
    #[serde(default)]
    pub title: String,
    /// 网站描述
    #[serde(default)]
    pub description: String,
    /// 关键词
    #[serde(default)]
    pub keywords: Vec<String>,
}

/// URL configuration (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UrlOptions {
    /// WebSocket URL
    #[serde(rename = "wsUrl", default)]
    pub ws_url: Option<String>,
    /// 管理后台URL
    #[serde(rename = "adminUrl", default)]
    pub admin_url: Option<String>,
    /// 服务器URL
    #[serde(rename = "serverUrl", default)]
    pub server_url: Option<String>,
    /// 网站URL
    #[serde(rename = "webUrl", default)]
    pub web_url: Option<String>,
}

/// Feature list configuration (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct FeatureListOptions {
    /// 是否启用邮件订阅
    #[serde(rename = "emailSubscribe", default)]
    pub email_subscribe: bool,
}

/// Friend link options (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct FriendLinkOptions {
    /// 是否允许申请友链
    #[serde(rename = "allowApply", default)]
    pub allow_apply: bool,
    /// 是否允许子路径
    #[serde(rename = "allowSubPath", default)]
    pub allow_sub_path: bool,
}

/// Comment options - only safe fields (partial exposure)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CommentOptionsPublic {
    /// 是否禁用评论
    #[serde(rename = "disableComment", default)]
    pub disable_comment: bool,
    /// 是否禁用中文检查
    #[serde(rename = "disableNoChinese", default)]
    pub disable_no_chinese: bool,
}

/// OAuth public configuration (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OAuthPublicOptions {
    /// OAuth提供商列表
    #[serde(default)]
    pub providers: Vec<OAuthProvider>,
    /// GitHub客户端ID
    #[serde(default)]
    pub github_client_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthProvider {
    /// 提供商类型
    #[serde(rename = "type")]
    pub provider_type: String,
    /// 是否启用
    pub enabled: bool,
}

/// Algolia search options - only public fields (partial exposure)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AlgoliaPublicOptions {
    /// 是否启用Algolia搜索
    #[serde(default)]
    pub enable: bool,
    /// Algolia应用ID
    #[serde(rename = "appId", default)]
    pub app_id: Option<String>,
    /// 索引名称
    #[serde(rename = "indexName", default)]
    pub index_name: Option<String>,
}

/// Admin extra - only safe fields (partial exposure)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AdminExtraPublic {
    /// 管理后台标题
    #[serde(default)]
    pub title: Option<String>,
    /// 背景图片
    #[serde(default)]
    pub background: Option<String>,
}

// ============================================================================
// Aggregated Site Config (Safe for frontend)
// ============================================================================

/// Aggregated site configuration that is safe to expose to frontend.
/// Matches Rocket's SiteConfig structure for data consistency.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SiteConfig {
    /// SEO配置
    pub seo: SeoOptions,
    /// URL配置
    pub url: UrlOptions,
    /// 功能配置
    pub features: FeatureListOptions,
    /// 友链配置
    pub friend_link: FriendLinkOptions,
    /// 评论配置
    pub comment: CommentOptionsPublic,
    /// OAuth配置
    pub oauth: OAuthPublicOptions,
    /// Algolia搜索配置
    pub algolia: AlgoliaPublicOptions,
    /// 管理员额外配置
    pub admin_extra: AdminExtraPublic,
}
