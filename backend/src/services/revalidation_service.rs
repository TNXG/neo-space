//! Revalidation service - Notify Next.js to revalidate ISR cache with HMAC signature

use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

/// Revalidation 服务 - 通知 Next.js 重新验证 ISR 缓存
#[derive(Clone)]
pub struct RevalidationService {
    nextjs_url: String,
    secret: String,
    salt: String,
}

impl RevalidationService {
    /// 创建新的 Revalidation 服务实例
    /// 
    /// # 参数
    /// - `nextjs_url`: Next.js 应用的 URL (例如: http://localhost:3000)
    /// - `secret`: HMAC 签名密钥
    /// - `salt`: 额外的盐值
    pub fn new(nextjs_url: String, secret: String, salt: String) -> Self {
        log::info!("Revalidation 服务初始化 - Next.js URL: {}", nextjs_url);
        Self {
            nextjs_url,
            secret,
            salt,
        }
    }

    /// 通过标签重新验证
    /// 
    /// # 参数
    /// - `tag`: 缓存标签 (例如: "posts", "notes", "pages")
    pub async fn revalidate_tag(&self, tag: &str) -> Result<(), Box<dyn std::error::Error>> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();

        // 构造签名消息: secret + timestamp + salt + tag
        let message = format!("{}{}{}{}", self.secret, timestamp, self.salt, tag);
        
        // 生成 HMAC-SHA256 签名
        let signature = self.generate_hmac(&message)?;

        // 构造请求 URL
        let url = format!("{}/api/revalidate", self.nextjs_url);

        // 构造请求体
        let body = serde_json::json!({
            "tag": tag,
            "timestamp": timestamp,
            "signature": signature,
        });

        log::debug!(
            "发送 Revalidation 请求 - Tag: {}, Timestamp: {}, Signature: {}",
            tag,
            timestamp,
            &signature[..16]
        );

        // 发送 HTTP POST 请求
        let client = reqwest::Client::new();
        let response = client
            .post(&url)
            .json(&body)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?;

        if response.status().is_success() {
            log::info!("✓ Revalidation 成功 - Tag: {}", tag);
            Ok(())
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            log::error!(
                "Revalidation 失败 - Status: {}, Error: {}",
                status,
                error_text
            );
            Err(format!("Revalidation failed with status: {}", status).into())
        }
    }

    /// 通过路径重新验证
    /// 
    /// # 参数
    /// - `path`: 页面路径 (例如: "/posts/my-post")
    pub async fn revalidate_path(&self, path: &str) -> Result<(), Box<dyn std::error::Error>> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_secs();

        // 构造签名消息: secret + timestamp + salt + path
        let message = format!("{}{}{}{}", self.secret, timestamp, self.salt, path);
        
        // 生成 HMAC-SHA256 签名
        let signature = self.generate_hmac(&message)?;

        // 构造请求 URL
        let url = format!("{}/api/revalidate", self.nextjs_url);

        // 构造请求体
        let body = serde_json::json!({
            "path": path,
            "timestamp": timestamp,
            "signature": signature,
        });

        log::debug!(
            "发送 Revalidation 请求 - Path: {}, Timestamp: {}, Signature: {}",
            path,
            timestamp,
            &signature[..16]
        );

        // 发送 HTTP POST 请求
        let client = reqwest::Client::new();
        let response = client
            .post(&url)
            .json(&body)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?;

        if response.status().is_success() {
            log::info!("✓ Revalidation 成功 - Path: {}", path);
            Ok(())
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            log::error!(
                "Revalidation 失败 - Status: {}, Error: {}",
                status,
                error_text
            );
            Err(format!("Revalidation failed with status: {}", status).into())
        }
    }

    /// 生成 HMAC-SHA256 签名
    fn generate_hmac(&self, message: &str) -> Result<String, Box<dyn std::error::Error>> {
        let mut mac = HmacSha256::new_from_slice(self.secret.as_bytes())?;
        mac.update(message.as_bytes());
        let result = mac.finalize();
        let code_bytes = result.into_bytes();
        Ok(hex::encode(code_bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hmac_generation() {
        let service = RevalidationService::new(
            "http://localhost:3000".to_string(),
            "test-secret".to_string(),
            "test-salt".to_string(),
        );

        let message = "test-secret1234567890test-saltposts";
        let signature = service.generate_hmac(message).unwrap();

        // 验证签名格式（应该是64个十六进制字符）
        assert_eq!(signature.len(), 64);
        assert!(signature.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
