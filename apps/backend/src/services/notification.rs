//! Notification service for comment notifications

use crate::error::AppError;
use crate::services::notification_templates::{
    build_html_email, build_text_email, generate_notification_url,
};
use bson::doc;
use futures::TryStreamExt;
use mongodb::Database;
use std::time::Duration;

/// Comment notification data
#[derive(Debug, Clone)]
pub struct CommentNotification {
    /// Comment author
    pub author: String,
    /// Comment text
    pub text: String,
    /// Comment author email
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
    /// Parent comment author (if reply)
    pub parent_author: Option<String>,
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
            .find(doc! { "name": { "$in": ["seo", "url"] } })
            .await
            .map_err(|e| AppError::Database(format!("Failed to load site options: {}", e)))?;

        let option_docs: Vec<bson::Document> = option_docs
            .try_collect()
            .await
            .map_err(|e| AppError::Database(format!("Failed to iterate site options: {}", e)))?;

        let mut site_name = "Neo Space".to_string();
        let mut site_url = "https://example.com".to_string();

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
        })
    }

    /// Send comment notification email
    pub async fn send_comment_notification(
        &self,
        notification: &CommentNotification,
    ) -> Result<(), AppError> {
        use lettre::{
            AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
            message::{Mailbox, MultiPart, SinglePart, header::ContentType},
            transport::smtp::authentication::Credentials,
        };

        // Get admin configuration
        let config = self.get_admin_config().await?;

        // Load email SMTP configuration
        let options_collection: mongodb::Collection<bson::Document> = self.db.collection("options");
        let mail_options = options_collection
            .find_one(doc! { "name": "mailOptions" })
            .await
            .map_err(|e| AppError::Database(format!("Failed to load email config: {}", e)))?;

        // Check if email is enabled
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
            return Ok(());
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

        // Get ref title and generate URL
        let ref_title = notification.ref_title.as_deref();
        let notification_url = generate_notification_url(
            &config.site_url,
            &notification.ref_type,
            &notification.ref_id,
            ref_title,
        );

        // Build email content
        let html_body = build_html_email(notification, &config, &notification_url);
        let text_body = build_text_email(notification, &config, &notification_url);

        let subject = if notification.is_reply {
            format!("[{}] 新回复: {}", config.site_name, notification.author)
        } else {
            format!("[{}] 新评论: {}", config.site_name, notification.author)
        };

        let from_mailbox = Mailbox::new(
            Some(format!("{} Notifications", config.site_name)),
            from_email.parse().map_err(|_| {
                AppError::Internal(format!("Invalid from_email format: {}", from_email))
            })?,
        );

        let to_mailbox = Mailbox::new(
            None,
            config
                .email
                .parse()
                .map_err(|_| AppError::BadRequest("Invalid admin email format".to_string()))?,
        );

        let email = Message::builder()
            .from(from_mailbox)
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

        let creds = Credentials::new(user.clone(), password);

        // Create SMTP transport
        let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host)
            .map_err(|e| AppError::Internal(format!("Failed to create mailer: {}", e)))?
            .port(port)
            .credentials(creds)
            .timeout(Some(Duration::from_secs(30)))
            .build();

        tracing::info!(
            "Sending comment notification email to {} for {} by {}",
            config.email,
            notification.ref_type,
            notification.author
        );

        mailer.send(email).await.map_err(|e| {
            tracing::error!("Failed to send notification email: {:?}", e);
            AppError::Internal(format!("Failed to send notification email: {}", e))
        })?;

        tracing::info!(
            "Comment notification email sent successfully to: {}",
            config.email
        );
        Ok(())
    }
}
