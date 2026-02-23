//! Verification code service - 验证码管理服务
//!
//! 使用内存缓存存储验证码，支持过期时间和验证次数限制

use moka::future::Cache;
use rand::RngExt;
use std::sync::Arc;
use std::time::Duration;

/// 验证码数据
#[derive(Debug, Clone)]
struct VerificationCode {
    code: String,
    attempts: u8, // 剩余尝试次数
}

/// 验证码服务
#[derive(Clone)]
pub struct VerificationService {
    cache: Arc<Cache<String, VerificationCode>>,
}

impl Default for VerificationService {
    fn default() -> Self {
        Self::new()
    }
}

impl VerificationService {
    /// 创建新的验证码服务
    pub fn new() -> Self {
        let cache = Cache::builder()
            .max_capacity(10_000)
            .time_to_live(Duration::from_secs(600)) // 10 分钟过期
            .build();

        Self {
            cache: Arc::new(cache),
        }
    }

    /// 生成 6 位数字验证码
    fn generate_code() -> String {
        let mut rng = rand::rng();
        format!("{:06}", rng.random_range(0..1_000_000))
    }
    /// 发送验证码（生成并存储）
    pub async fn send_code(&self, email: &str) -> String {
        let code = Self::generate_code();
        let verification = VerificationCode {
            code: code.clone(),
            attempts: 3, // 允许 3 次尝试
        };

        self.cache.insert(email.to_lowercase(), verification).await;

        code
    }

    /// 验证验证码
    pub async fn verify_code(&self, email: &str, code: &str) -> Result<(), String> {
        let email_key = email.to_lowercase();

        let mut verification = self
            .cache
            .get(&email_key)
            .await
            .ok_or("验证码不存在或已过期")?;

        if verification.attempts == 0 {
            self.cache.invalidate(&email_key).await;
            return Err("验证码尝试次数已用完".to_string());
        }

        if verification.code != code {
            verification.attempts -= 1;
            if verification.attempts > 0 {
                self.cache.insert(email_key, verification.clone()).await;
                return Err(format!(
                    "验证码错误，还剩 {} 次尝试机会",
                    verification.attempts
                ));
            }
            self.cache.invalidate(&email_key).await;
            return Err("验证码错误，尝试次数已用完".to_string());
        }

        // 验证成功，删除验证码
        self.cache.invalidate(&email_key).await;
        Ok(())
    }

    /// 检查验证码是否存在（用于限制发送频率）
    pub async fn has_code(&self, email: &str) -> bool {
        self.cache.get(&email.to_lowercase()).await.is_some()
    }
}
