//! 配置加载
//!
//! 负责应用配置的加载和验证

use crate::config::OAuthConfig;

/// 加载应用配置
///
/// 从环境变量加载 OAuth 配置
pub fn load_config() -> Result<OAuthConfig, Box<dyn std::error::Error>> {
    let oauth_config = OAuthConfig::from_env()?;
    Ok(oauth_config)
}
