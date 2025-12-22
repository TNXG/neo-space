use crate::models::{Account, ReaderResponse};

// 让 Account 可以直接转为 ReaderResponse（用于新用户临时显示）
impl From<&Account> for ReaderResponse {
    fn from(acc: &Account) -> Self {
        Self {
            id: acc.user_id,
            email: acc.oauth_email.clone().unwrap_or_default(),
            name: acc.oauth_name.clone().unwrap_or_else(|| "新用户".to_string()),
            handle: acc.oauth_handle.clone().unwrap_or_default(),
            image: acc.oauth_avatar.clone().unwrap_or_default(),
            is_owner: false, // 临时态由 AuthGuard 覆盖
            email_verified: Some(false),
            created_at: acc.created_at,
            updated_at: acc.updated_at,
        }
    }
}