pub struct AvatarService;

impl AvatarService {
    /// 计算 Gravatar 地址
    pub fn get_gravatar_url(email: &str) -> String {
        format!(
            "https://cravatar.cn/avatar/{:x}",
            md5::compute(email.trim().to_lowercase().as_bytes())
        )
    }

    /// 从 Account 获取第三方头像
    pub fn get_oauth_avatar(provider: &str, accounts: &[crate::models::Account]) -> Option<String> {
        accounts.iter()
            .find(|acc| acc.provider == provider)
            .and_then(|acc| acc.oauth_avatar.clone())
    }
}