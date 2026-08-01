//! Notification service for comment notifications

use crate::error::AppError;
use crate::external::email_templates::EmailTemplateConfig;
use crate::services::notification_recipients;
use crate::services::notification_templates::{
    build_html_email, build_subject, build_text_email, generate_notification_url,
};
use bson::doc;
use futures::TryStreamExt;
use mongodb::Database;
use std::time::Duration;

/// Comment notification data
#[derive(Debug, Clone)]
pub struct CommentNotification {
    /// 新评论的 _id（ObjectId hex），用于日志
    pub comment_id: String,
    /// Comment author
    pub author: String,
    /// Comment text
    pub text: String,
    /// Comment author email（用于自回复去重——绝不给该邮箱发送提醒）
    pub email: String,
    /// Reference type (post/note)
    pub ref_type: String,
    /// Reference ID
    pub ref_id: String,
    /// Reference title (if available)
    pub ref_title: Option<String>,
    /// Comment timestamp
    pub created: bson::DateTime,
    /// Is a reply to another comment
    pub is_reply: bool,
    /// 直接父级评论的 _id（hex）——邮件深链与前端滚动定位都指向它，而非根评论
    pub parent_comment_id: Option<String>,
    /// Parent comment author (if reply)
    pub parent_author: Option<String>,
    /// 直接父级评论作者邮箱——回复提醒精准投递给该邮箱
    pub parent_author_email: Option<String>,
    /// User agent (browser info)
    pub ua: Option<String>,
    /// IP location
    pub location: Option<String>,
}

/// Admin email configuration from database
#[derive(Debug, Clone)]
pub struct AdminEmailConfig {
    pub email: String,
    pub site_name: String,
    pub site_url: String,
    pub email_templates: EmailTemplateConfig,
}

/// Notification service
#[derive(Clone)]
pub struct NotificationService {
    db: Database,
}

impl NotificationService {
    /// Create a new notification service
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Load admin email configuration from database
    pub async fn get_admin_config(&self) -> Result<AdminEmailConfig, AppError> {
        let collection: mongodb::Collection<bson::Document> = self.db.collection("options");

        let option_docs = collection
            .find(doc! { "name": { "$in": ["seo", "url", "mailOptions"] } })
            .await
            .map_err(|e| AppError::Database(format!("Failed to load site options: {}", e)))?;

        let option_docs: Vec<bson::Document> = option_docs
            .try_collect()
            .await
            .map_err(|e| AppError::Database(format!("Failed to iterate site options: {}", e)))?;

        let mut site_name = "Neo Space".to_string();
        let mut site_url = "https://example.com".to_string();
        let mut email_templates = EmailTemplateConfig::default();

        for doc in option_docs {
            let name = doc.get_str("name").unwrap_or_default();
            let value = match doc.get_document("value") {
                Ok(value) => value,
                Err(_) => continue,
            };

            match name {
                "seo" => {
                    if let Ok(title) = value.get_str("title")
                        && !title.trim().is_empty()
                    {
                        site_name = title.trim().to_string();
                    }
                }
                "url" => {
                    if let Ok(url) = value.get_str("webUrl")
                        && !url.trim().is_empty()
                    {
                        site_url = url.trim().to_string();
                    }
                }
                "mailOptions" => {
                    email_templates = EmailTemplateConfig::from_mail_options(value);
                }
                _ => {}
            }
        }

        let owner_profiles: mongodb::Collection<bson::Document> =
            self.db.collection("owner_profiles");
        let owner_profile = owner_profiles
            .find_one(doc! {})
            .await
            .map_err(|e| AppError::Database(format!("Failed to load owner profile: {}", e)))?;

        let owner_profile = owner_profile
            .ok_or_else(|| AppError::Internal("Owner profile not configured".to_string()))?;

        let admin_email = owner_profile
            .get_str("mail")
            .ok()
            .filter(|email| !email.trim().is_empty())
            .map(|email| email.trim().to_string())
            .or_else(|| {
                owner_profile
                    .get_document("socialIds")
                    .ok()
                    .and_then(|social_ids| social_ids.get_str("mail").ok())
                    .filter(|email| !email.trim().is_empty())
                    .map(|email| email.trim().to_string())
            })
            .ok_or_else(|| AppError::Internal("Admin email not configured".to_string()))?;

        Ok(AdminEmailConfig {
            email: admin_email,
            site_name,
            site_url,
            email_templates,
        })
    }

    /// 解析 SMTP 配置；邮件未启用时返回 Ok(None)。
    async fn load_smtp_config(&self) -> Result<Option<SmtpConfig>, AppError> {
        let options_collection: mongodb::Collection<bson::Document> = self.db.collection("options");
        let mail_options = options_collection
            .find_one(doc! { "name": "mailOptions" })
            .await
            .map_err(|e| AppError::Database(format!("Failed to load email config: {}", e)))?;

        let email_enabled = match mail_options.as_ref() {
            Some(doc) => doc
                .get_document("value")
                .ok()
                .and_then(|value| value.get_bool("enable").ok())
                .unwrap_or(false),
            None => false,
        };
        if !email_enabled {
            tracing::info!("Email service is disabled, skipping notification");
            return Ok(None);
        }

        let mail_doc = mail_options
            .ok_or_else(|| AppError::Internal("Invalid email config format".to_string()))?;
        let value = mail_doc
            .get_document("value")
            .map_err(|_| AppError::Internal("Email config value missing".to_string()))?;
        let options = value
            .get_document("smtp")
            .map_err(|_| AppError::Internal("SMTP configuration missing".to_string()))?;

        let user = options
            .get_str("user")
            .map_err(|_| AppError::Internal("Email username not configured".to_string()))?
            .to_string();
        let from_email = value.get_str("from").unwrap_or(&user).to_string();
        let from_name = value.get_str("fromName").unwrap_or("Neo Space").to_string();
        let password = options
            .get_str("pass")
            .map_err(|_| AppError::Internal("Email password not configured".to_string()))?
            .to_string();
        let host = options
            .get_str("host")
            .map_err(|_| AppError::Internal("SMTP host not configured".to_string()))?
            .to_string();
        let port = u16::try_from(options.get_i32("port").unwrap_or(587))
            .map_err(|_| AppError::Internal("Invalid email port".to_string()))?;

        Ok(Some(SmtpConfig {
            user,
            from_name,
            from_email,
            password,
            host,
            port,
        }))
    }

    /// 发送评论通知——按收件人 fan-out，已做自回复去重与多身份合并。
    ///
    /// 规则参见 `notification_recipients::build_recipients`：
    /// - 回复精准投递给「直接父级评论作者」而非根评论作者；
    /// - 评论作者本人绝不收到提醒；
    /// - 同一邮箱既是文章作者又是直接父级评论作者时合并为一条高优先级通知。
    pub async fn send_comment_notification(
        &self,
        notification: &CommentNotification,
    ) -> Result<(), AppError> {
        use lettre::{
            AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
            message::{Mailbox, MultiPart, SinglePart, header::ContentType},
            transport::smtp::authentication::Credentials,
        };

        let config = self.get_admin_config().await?;
        let Some(smtp) = self.load_smtp_config().await? else {
            return Ok(());
        };

        // 解析收件人（已去重 / 自回复过滤 / 优先级标注）
        let recipients = notification_recipients::build_recipients(notification, &config.email);
        if recipients.is_empty() {
            tracing::info!(
                "No notification recipients for comment {} (self-reply or self-comment), skipping",
                notification.comment_id
            );
            return Ok(());
        }

        // 回复深链指向「直接父级评论」，前端据此滚动定位 + 展开回复输入框
        let notification_url = generate_notification_url(
            &config.site_url,
            &notification.ref_type,
            &notification.ref_id,
            notification.ref_title.as_deref(),
            notification.parent_comment_id.as_deref(),
        );

        let from_mailbox = Mailbox::new(
            Some(smtp.from_name.clone()),
            smtp.from_email.parse().map_err(|_| {
                AppError::Internal(format!("Invalid from_email format: {}", smtp.from_email))
            })?,
        );

        let creds = Credentials::new(smtp.user.clone(), smtp.password.clone());
        let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&smtp.host)
            .map_err(|e| AppError::Internal(format!("Failed to create mailer: {}", e)))?
            .port(smtp.port)
            .credentials(creds)
            .timeout(Some(Duration::from_secs(30)))
            .build();

        for recipient in &recipients {
            let to_mailbox = Mailbox::new(
                None,
                recipient.email.parse().map_err(|_| {
                    AppError::Internal(format!("Invalid recipient email: {}", recipient.email))
                })?,
            );

            let subject = build_subject(notification, &config, recipient);
            let html_body = build_html_email(notification, &config, &notification_url, recipient);
            let text_body = build_text_email(notification, &config, &notification_url, recipient);

            let email = Message::builder()
                .from(from_mailbox.clone())
                .to(to_mailbox)
                .subject(subject)
                .multipart(
                    MultiPart::alternative()
                        .singlepart(SinglePart::plain(text_body))
                        .singlepart(
                            SinglePart::builder()
                                .header(ContentType::TEXT_HTML)
                                .body(html_body),
                        ),
                )
                .map_err(|e| AppError::Internal(format!("Failed to build email: {}", e)))?;

            tracing::info!(
                "Sending comment notification to {} (priority={:?}) for comment {} by {}",
                recipient.email,
                recipient.priority,
                notification.comment_id,
                notification.author,
            );

            if let Err(e) = mailer.send(email).await {
                tracing::error!(
                    "Failed to send notification to {}: {:?}",
                    recipient.email,
                    e
                );
            }
        }

        tracing::info!(
            "Comment notification dispatched to {} recipient(s) for comment {}",
            recipients.len(),
            notification.comment_id,
        );
        Ok(())
    }
}

/// SMTP 配置（由 `mailOptions` 解析而来）。
struct SmtpConfig {
    user: String,
    from_name: String,
    from_email: String,
    password: String,
    host: String,
    port: u16,
}
