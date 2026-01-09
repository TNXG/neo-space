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
    client: reqwest::Client,
}

impl RevalidationService {
    /// 创建新的 Revalidation 服务实例
    ///
    /// # 参数
    /// - `nextjs_url`: Next.js 应用的 URL (例如: <http://localhost:3000>)
    /// - `secret`: HMAC 签名密钥
    /// - `salt`: 额外的盐值
    pub fn new(nextjs_url: String, secret: String, salt: String) -> Self {
        log::info!("Revalidation 服务初始化 - Next.js URL: {nextjs_url}");
        Self {
            nextjs_url,
            secret,
            salt,
            client: reqwest::Client::new(),
        }
    }

    /// 通过标签重新验证（仅刷新 fetch 数据缓存）
    ///
    /// # 参数
    /// - `tag`: 缓存标签 (例如: "posts", "notes", "pages")
    pub async fn revalidate_tag(&self, tag: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.revalidate(Some(tag), None).await
    }

    /// 通过路径重新验证（刷新 ISR 页面缓存）
    ///
    /// # 参数
    /// - `path`: 页面路径 (例如: "/posts", "/notes")
    #[allow(unused)]
    pub async fn revalidate_path(&self, path: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.revalidate(None, Some(path)).await
    }

    /// 同时刷新标签和路径（推荐：确保数据和页面都刷新）
    ///
    /// # 参数
    /// - `tag`: 缓存标签
    /// - `path`: 页面路径
    pub async fn revalidate_both(
        &self,
        tag: &str,
        path: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.revalidate(Some(tag), Some(path)).await
    }

    /// 批量刷新多个标签和路径
    ///
    /// # 参数
    /// - `tags`: 缓存标签列表
    /// - `paths`: 页面路径列表
    #[allow(unused)]
    pub async fn revalidate_batch(
        &self,
        tags: &[&str],
        paths: &[&str],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut errors = Vec::new();

        // 刷新所有标签
        for tag in tags {
            if let Err(e) = self.revalidate_tag(tag).await {
                errors.push(format!("Tag '{tag}': {e}"));
            }
        }

        // 刷新所有路径
        for path in paths {
            if let Err(e) = self.revalidate_path(path).await {
                errors.push(format!("Path '{path}': {e}"));
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("; ").into())
        }
    }

    /// 内部方法：发送 revalidate 请求
    async fn revalidate(
        &self,
        tag: Option<&str>,
        path: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();

        // 构造签名消息: secret + timestamp + salt + tag + path
        let tag_str = tag.unwrap_or("");
        let path_str = path.unwrap_or("");
        let message = format!(
            "{}{}{}{}{}",
            self.secret, timestamp, self.salt, tag_str, path_str
        );

        // 生成 HMAC-SHA256 签名
        let signature = self.generate_hmac(&message)?;

        // 构造请求 URL
        let url = format!("{}/api/revalidate", self.nextjs_url);

        // 构造请求体
        let mut body = serde_json::json!({
            "timestamp": timestamp,
            "signature": signature,
        });

        if let Some(t) = tag {
            if let Some(obj) = body.as_object_mut() {
                obj.insert("tag".to_string(), serde_json::Value::String(t.to_string()));
            }
        }
        if let Some(p) = path {
            if let Some(obj) = body.as_object_mut() {
                obj.insert("path".to_string(), serde_json::Value::String(p.to_string()));
            }
        }

        let target = match (tag, path) {
            (Some(t), Some(p)) => format!("Tag: {t}, Path: {p}"),
            (Some(t), None) => format!("Tag: {t}"),
            (None, Some(p)) => format!("Path: {p}"),
            (None, None) => "None".to_string(),
        };

        log::debug!(
            "发送 Revalidation 请求 - {target}, Timestamp: {timestamp}"
        );

        // 发送 HTTP POST 请求
        let response = self
            .client
            .post(&url)
            .json(&body)
            .timeout(std::time::Duration::from_secs(10))
            .send()
            .await?;

        if response.status().is_success() {
            log::info!("✓ Revalidation 成功 - {target}");
            Ok(())
        } else {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            log::error!("Revalidation 失败 - Status: {status}, Error: {error_text}");
            Err(format!("Revalidation failed with status: {status}").into())
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
        let signature = service.generate_hmac(message);
        assert!(signature.is_ok(), "Failed to generate HMAC: {:?}", signature.err());
        
        if let Ok(sig) = signature {
            // 验证签名格式（应该是64个十六进制字符）
            assert_eq!(sig.len(), 64);
            assert!(sig.chars().all(|c| c.is_ascii_hexdigit()));
        }
    }
}
