//! Email configuration from database

use mongodb::{bson::doc, Database};
use std::error::Error;

/// SMTP 加密方式
#[derive(Debug, Clone, PartialEq)]
pub enum SmtpEncryption {
    /// STARTTLS (端口 587)
    StartTls,
    /// 直接 TLS/SSL (端口 465)
    Tls,
    /// 无加密 (不推荐)
    None,
}

/// 邮箱配置（从数据库读取）
#[derive(Debug, Clone)]
pub struct EmailConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub from_name: String,
    pub from_email: String,
    pub encryption: SmtpEncryption,
}

/// 从数据库读取邮箱配置
pub async fn get_email_config(db: &Database) -> Result<EmailConfig, Box<dyn Error>> {
    let collection: mongodb::Collection<mongodb::bson::Document> = db.collection("options");

    let option = collection
        .find_one(doc! { "name": "mailOptions" })
        .await?
        .ok_or("邮箱配置不存在")?;

    let value = option
        .get_document("value")
        .map_err(|_| "邮箱配置格式错误")?;

    // 检查是否启用邮件功能
    if !value.get_bool("enable").unwrap_or(false) {
        return Err("邮件功能未启用".into());
    }

    // 读取 options 子文档
    let options = value
        .get_document("options")
        .map_err(|_| "邮箱 options 配置缺失")?;

    let user = value
        .get_str("user")
        .map_err(|_| "邮箱用户名未配置")?
        .to_string();
    let from_email = value.get_str("from").unwrap_or(&user).to_string();

    let port = u16::try_from(options.get_i32("port").unwrap_or(587))
        .map_err(|_| "邮箱端口号无效")?;

    let secure = options.get_bool("secure").unwrap_or(false);

    // 修正后的加密逻辑判断
    let encryption = if port == 465 {
        // 465 端口几乎永远是隐式 TLS
        SmtpEncryption::Tls
    } else if port == 587 {
        // 587 端口几乎永远是 STARTTLS
        SmtpEncryption::StartTls
    } else if secure {
        // 如果是其他非标准端口但标记了 secure，尝试隐式 TLS
        SmtpEncryption::Tls
    } else if port == 25 {
        SmtpEncryption::None
    } else {
        // 默认 fallback 到 STARTTLS
        SmtpEncryption::StartTls
    };

    Ok(EmailConfig {
        host: options
            .get_str("host")
            .map_err(|_| "SMTP 主机未配置")?
            .to_string(),
        port,
        user: user.clone(),
        password: value
            .get_str("pass")
            .map_err(|_| "邮箱密码未配置")?
            .to_string(),
        from_name: "Neo Space".to_string(),
        from_email,
        encryption,
    })
}
