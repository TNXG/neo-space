//! Email service - SMTP email sending with verification codes

use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, MultiPart, SinglePart, header::ContentType},
    transport::smtp::authentication::Credentials,
};
use moka::future::Cache;
use mongodb::Database;
use rand::RngExt;
use std::sync::Arc;
use std::time::Duration;

use super::email_templates;
use crate::error::AppError;

/// SMTP encryption type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmtpEncryption {
    /// STARTTLS (port 587)
    StartTls,
    /// Direct TLS/SSL (port 465)
    Tls,
    /// No encryption (not recommended)
    None,
}

/// Email configuration (loaded from database)
#[derive(Debug, Clone)]
pub struct EmailConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: String,
    pub from_name: String,
    pub from_email: String,
    pub encryption: SmtpEncryption,
    pub templates: email_templates::EmailTemplateConfig,
}

/// Verification code data
#[derive(Debug, Clone)]
struct VerificationCode {
    code: String,
    attempts: u8,
}

/// Email service with verification code support
#[derive(Clone)]
pub struct EmailService {
    db: Database,
    cache: Arc<Cache<String, VerificationCode>>,
}

impl EmailService {
    /// Create a new email service
    pub fn new(db: Database) -> Self {
        let cache = Cache::builder()
            .max_capacity(10_000)
            .time_to_live(Duration::from_secs(600)) // 10 minutes expiry
            .build();

        Self {
            db,
            cache: Arc::new(cache),
        }
    }

    /// Load email configuration from database
    pub async fn get_config(&self) -> Result<EmailConfig, AppError> {
        use bson::doc;

        let collection: mongodb::Collection<bson::Document> = self.db.collection("options");

        let option = collection
            .find_one(doc! { "name": "mailOptions" })
            .await
            .map_err(|e| AppError::Database(format!("Failed to load email config: {}", e)))?
            .ok_or_else(|| AppError::Internal("Email configuration not found".to_string()))?;

        let value = option
            .get_document("value")
            .map_err(|_| AppError::Internal("Invalid email config format".to_string()))?;

        // Check if email is enabled
        if !value.get_bool("enable").unwrap_or(false) {
            return Err(AppError::Internal(
                "Email service is not enabled".to_string(),
            ));
        }

        // Read smtp sub-document
        let smtp = value
            .get_document("smtp")
            .map_err(|_| AppError::Internal("Email options missing".to_string()))?;

        let user = smtp
            .get_str("user")
            .map_err(|_| AppError::Internal("Email username not configured".to_string()))?
            .to_string();
        let from_email = value.get_str("from").unwrap_or(&user).to_string();

        let port = u16::try_from(smtp.get_i32("port").unwrap_or(587))
            .map_err(|_| AppError::Internal("Invalid email port".to_string()))?;

        let secure = smtp.get_bool("secure").unwrap_or(false);

        // Determine encryption type based on port and secure setting
        let encryption = if port == 465 {
            SmtpEncryption::Tls
        } else if port == 587 {
            SmtpEncryption::StartTls
        } else if secure {
            SmtpEncryption::Tls
        } else if port == 25 {
            SmtpEncryption::None
        } else {
            SmtpEncryption::StartTls
        };

        Ok(EmailConfig {
            host: smtp
                .get_str("host")
                .map_err(|_| AppError::Internal("SMTP host not configured".to_string()))?
                .to_string(),
            port,
            user: user.clone(),
            password: smtp
                .get_str("pass")
                .map_err(|_| AppError::Internal("Email password not configured".to_string()))?
                .to_string(),
            from_name: value.get_str("fromName").unwrap_or("Neo Space").to_string(),
            from_email,
            encryption,
            templates: email_templates::EmailTemplateConfig::from_mail_options(value),
        })
    }

    /// Send verification code email
    pub async fn send_verification_email(
        &self,
        to_email: &str,
        code: &str,
        site_name: &str,
    ) -> Result<(), AppError> {
        let config = self.get_config().await?;

        // Build email body from templates
        let html_body =
            email_templates::build_verification_html(code, site_name, &config.templates);
        let text_body = email_templates::build_verification_text(code, site_name);
        let subject = email_templates::render_template(
            &config.templates.verification_subject,
            &[("site_name", site_name)],
        );

        let from_mailbox = Mailbox::new(
            Some(config.from_name.clone()),
            config.from_email.parse().map_err(|_| {
                AppError::Internal(format!("Invalid from_email format: {}", config.from_email))
            })?,
        );

        let to_mailbox = Mailbox::new(
            None,
            to_email
                .parse()
                .map_err(|_| AppError::BadRequest("Invalid recipient email format".to_string()))?,
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

        let creds = Credentials::new(config.user.clone(), config.password.clone());

        // Create SMTP transport based on encryption type
        let mailer = match config.encryption {
            SmtpEncryption::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
                .map_err(|e| AppError::Internal(format!("Failed to create TLS mailer: {}", e)))?
                .port(config.port)
                .credentials(creds)
                .timeout(Some(Duration::from_secs(30)))
                .build(),
            SmtpEncryption::StartTls => {
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
                    .map_err(|e| {
                        AppError::Internal(format!("Failed to create STARTTLS mailer: {}", e))
                    })?
                    .port(config.port)
                    .credentials(creds)
                    .timeout(Some(Duration::from_secs(30)))
                    .build()
            }
            SmtpEncryption::None => {
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                    .port(config.port)
                    .credentials(creds)
                    .timeout(Some(Duration::from_secs(30)))
                    .build()
            }
        };

        tracing::info!(
            "Sending email via {}:{} ({:?}) to {}...",
            config.host,
            config.port,
            config.encryption,
            to_email
        );

        mailer.send(email).await.map_err(|e| {
            tracing::error!("Email service error: {:?}", e);
            AppError::Internal(format!("SMTP send failed: {}", e))
        })?;

        tracing::info!("Email successfully sent to: {}", to_email);
        Ok(())
    }

    /// 发送由博主明确撰写并确认的邮件，同时提供品牌 HTML 与纯文本降级内容。
    pub async fn send_owner_email(
        &self,
        to_email: &str,
        subject: &str,
        content: &str,
        site_name: &str,
    ) -> Result<(), AppError> {
        let config = self.get_config().await?;
        let from_mailbox = Mailbox::new(
            Some(config.from_name.clone()),
            config.from_email.parse().map_err(|_| {
                AppError::Internal(format!("Invalid from_email format: {}", config.from_email))
            })?,
        );
        let to_mailbox = Mailbox::new(
            None,
            to_email
                .parse()
                .map_err(|_| AppError::BadRequest("Invalid recipient email format".to_string()))?,
        );
        let html_body =
            email_templates::build_owner_html(subject, content, site_name, &config.templates);
        let email = Message::builder()
            .from(from_mailbox)
            .to(to_mailbox)
            .subject(subject)
            .multipart(
                MultiPart::alternative()
                    .singlepart(SinglePart::plain(content.to_string()))
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html_body),
                    ),
            )
            .map_err(|error| AppError::BadRequest(format!("Invalid email content: {error}")))?;
        let credentials = Credentials::new(config.user.clone(), config.password.clone());
        let mailer = match config.encryption {
            SmtpEncryption::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
                .map_err(|error| {
                    AppError::Internal(format!("Failed to create TLS mailer: {error}"))
                })?
                .port(config.port)
                .credentials(credentials)
                .timeout(Some(Duration::from_secs(30)))
                .build(),
            SmtpEncryption::StartTls => {
                AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
                    .map_err(|error| {
                        AppError::Internal(format!("Failed to create STARTTLS mailer: {error}"))
                    })?
                    .port(config.port)
                    .credentials(credentials)
                    .timeout(Some(Duration::from_secs(30)))
                    .build()
            }
            SmtpEncryption::None => {
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                    .port(config.port)
                    .credentials(credentials)
                    .timeout(Some(Duration::from_secs(30)))
                    .build()
            }
        };

        tracing::info!("Owner confirmed an email to {}", to_email);
        mailer.send(email).await.map_err(|error| {
            tracing::error!("Owner email delivery failed: {:?}", error);
            AppError::Internal(format!("SMTP send failed: {error}"))
        })?;

        Ok(())
    }

    /// Generate a 6-digit verification code
    fn generate_code() -> String {
        let mut rng = rand::rng();
        format!("{:06}", rng.random_range(0..1_000_000))
    }

    /// Send verification code (generate and store in cache)
    pub async fn send_code(&self, email: &str) -> Result<String, AppError> {
        let code = Self::generate_code();
        let verification = VerificationCode {
            code: code.clone(),
            attempts: 3, // Allow 3 attempts
        };

        self.cache.insert(email.to_lowercase(), verification).await;

        Ok(code)
    }

    /// Verify a verification code
    pub async fn verify_code(&self, email: &str, code: &str) -> Result<(), AppError> {
        let email_key = email.to_lowercase();

        let mut verification = self.cache.get(&email_key).await.ok_or_else(|| {
            AppError::BadRequest("Verification code not found or expired".to_string())
        })?;

        if verification.attempts == 0 {
            self.cache.invalidate(&email_key).await;
            return Err(AppError::BadRequest(
                "No more attempts remaining".to_string(),
            ));
        }

        // Constant-time comparison to prevent timing attacks
        let expected_bytes = verification.code.as_bytes();
        let provided_bytes = code.as_bytes();
        let matches = if expected_bytes.len() != provided_bytes.len() {
            false
        } else {
            expected_bytes
                .iter()
                .zip(provided_bytes.iter())
                .fold(0u8, |acc, (a, b)| acc | (a ^ b))
                == 0
        };

        if !matches {
            verification.attempts -= 1;
            if verification.attempts > 0 {
                self.cache.insert(email_key, verification.clone()).await;
                return Err(AppError::BadRequest(format!(
                    "Incorrect code, {} attempts remaining",
                    verification.attempts
                )));
            }
            self.cache.invalidate(&email_key).await;
            return Err(AppError::BadRequest(
                "Incorrect code, no attempts remaining".to_string(),
            ));
        }

        // Verification successful, remove the code
        self.cache.invalidate(&email_key).await;
        Ok(())
    }

    /// Check if a verification code exists (for rate limiting)
    pub async fn has_code(&self, email: &str) -> bool {
        self.cache.get(&email.to_lowercase()).await.is_some()
    }

    /// Send verification code via email
    pub async fn send_verification_code_email(
        &self,
        email: &str,
        site_name: &str,
    ) -> Result<(), AppError> {
        // Check if there's already a valid code (rate limiting)
        if self.has_code(email).await {
            return Err(AppError::BadRequest(
                "Verification code already sent, please wait".to_string(),
            ));
        }

        // Generate and store the code
        let code = self.send_code(email).await?;

        // Send the email
        self.send_verification_email(email, &code, site_name).await
    }
}
