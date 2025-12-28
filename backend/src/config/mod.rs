//! Configuration modules

pub mod settings;
pub mod email;

pub use settings::{OAuthConfig, ConfigError};
pub use email::{get_email_config, SmtpEncryption};
