//! Site options models (safe for frontend exposure)

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
    pub title: String,
    pub description: String,
    pub keywords: Vec<String>,
}

/// URL configuration (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct UrlOptions {
    #[serde(rename = "wsUrl")]
    pub ws_url: Option<String>,
    #[serde(rename = "adminUrl")]
    pub admin_url: Option<String>,
    #[serde(rename = "serverUrl")]
    pub server_url: Option<String>,
    #[serde(rename = "webUrl")]
    pub web_url: Option<String>,
}

/// Feature list configuration (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct FeatureListOptions {
    #[serde(rename = "emailSubscribe", default)]
    pub email_subscribe: bool,
}

/// Friend link options (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct FriendLinkOptions {
    #[serde(rename = "allowApply", default)]
    pub allow_apply: bool,
    #[serde(rename = "allowSubPath", default)]
    pub allow_sub_path: bool,
}

/// Comment options - only safe fields (partial exposure)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct CommentOptionsPublic {
    #[serde(rename = "disableComment", default)]
    pub disable_comment: bool,
    #[serde(rename = "disableNoChinese", default)]
    pub disable_no_chinese: bool,
}

/// OAuth public configuration (safe to expose)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct OAuthPublicOptions {
    pub providers: Vec<OAuthProvider>,
    pub github_client_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthProvider {
    #[serde(rename = "type")]
    pub provider_type: String,
    pub enabled: bool,
}

/// Algolia search options - only public fields (partial exposure)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AlgoliaPublicOptions {
    pub enable: bool,
    #[serde(rename = "appId")]
    pub app_id: Option<String>,
    #[serde(rename = "indexName")]
    pub index_name: Option<String>,
}

/// Admin extra - only safe fields (partial exposure)
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct AdminExtraPublic {
    pub title: Option<String>,
    pub background: Option<String>,
}

// ============================================================================
// Aggregated Site Config (Safe for frontend)
// ============================================================================

/// Aggregated site configuration that is safe to expose to frontend
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct SiteConfig {
    pub seo: SeoOptions,
    pub url: UrlOptions,
    pub features: FeatureListOptions,
    pub friend_link: FriendLinkOptions,
    pub comment: CommentOptionsPublic,
    pub oauth: OAuthPublicOptions,
    pub algolia: AlgoliaPublicOptions,
    pub admin_extra: AdminExtraPublic,
}
