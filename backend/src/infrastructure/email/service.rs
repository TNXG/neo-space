//! Email service - 邮件发送服务
//!
//! 从数据库 options 集合读取邮箱配置，支持 SMTP 发送邮件

use chrono::Datelike;
use lettre::{
    message::{header::ContentType, Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use mongodb::Database;
use std::error::Error;

use crate::config::{get_email_config, SmtpEncryption};

/// 发送验证码邮件
pub async fn send_verification_email(
    db: &Database,
    to_email: &str,
    code: &str,
    site_name: &str,
) -> Result<(), Box<dyn Error>> {
    let config = get_email_config(db).await?;

    // 构建 HTML 邮件内容
    let html_body = format!(
        r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ margin: 0; padding: 0; font-family: -apple-system, sans-serif; background: #f4f7f6; }}
        .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }}
        .header {{ background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 30px; text-align: center; color: white; }}
        .content {{ padding: 40px 30px; }}
        .code-container {{ background: #f0fdfa; border: 2px dashed #14b8a6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }}
        .code {{ font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px; }}
        .footer {{ background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>验证码</h1></div>
        <div class="content">
            <p>你好！</p>
            <p>感谢你访问 <strong>{}</strong>。请使用下方的验证码完成操作：</p>
            <div class="code-container">
                <div class="code">{}</div>
                <p style="font-size: 12px; color: #666;">有效期 10 分钟</p>
            </div>
            <p style="color: #92400e; font-size: 13px;">⚠️ 如果非本人操作，请忽略此邮件。</p>
        </div>
        <div class="footer">
            <p>© {} {} · Powered by Neo Space</p>
        </div>
    </div>
</body>
</html>
"#,
        site_name,
        code,
        chrono::Utc::now().year(),
        site_name
    );

    let text_body = format!(
        "你好！\n\n你的验证码是：{}\n\n有效期 10 分钟。\n\n© {} {}",
        code,
        chrono::Utc::now().year(),
        site_name
    );

    let from_mailbox = Mailbox::new(Some(config.from_name.clone()), config.from_email.parse()?);

    let to_mailbox = Mailbox::new(None, to_email.parse().map_err(|_| "收件人邮箱格式不正确")?);

    let email = Message::builder()
        .from(from_mailbox)
        .to(to_mailbox)
        .subject(format!("[{site_name}] 验证码"))
        .multipart(
            MultiPart::alternative()
                .singlepart(SinglePart::plain(text_body))
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(html_body),
                ),
        )?;

    let creds = Credentials::new(config.user.clone(), config.password.clone());

    // 根据加密方式创建不同的 SMTP 传输
    let mailer = match config.encryption {
        SmtpEncryption::Tls => {
            // 直接 TLS (端口 465)
            AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)?
                .port(config.port)
                .credentials(creds)
                .timeout(Some(std::time::Duration::from_secs(30)))
                .build()
        }
        SmtpEncryption::StartTls => {
            // STARTTLS (端口 587)
            AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)?
                .port(config.port)
                .credentials(creds)
                .timeout(Some(std::time::Duration::from_secs(30)))
                .build()
        }
        SmtpEncryption::None => {
            // 无加密 (不推荐)
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                .port(config.port)
                .credentials(creds)
                .timeout(Some(std::time::Duration::from_secs(30)))
                .build()
        }
    };

    log::info!(
        "正在通过 {}:{} ({:?}) 发送邮件至 {}...",
        config.host,
        config.port,
        config.encryption,
        to_email
    );

    mailer.send(email).await.map_err(|e| {
        log::error!("邮件服务抛出异常: {e:?}");
        format!("SMTP发送失败: {e}")
    })?;

    log::info!("邮件已成功传达给: {to_email}");
    Ok(())
}
