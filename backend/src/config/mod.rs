//! Configuration modules

pub mod email;
pub mod settings;

pub use email::{get_email_config, SmtpEncryption};
pub use settings::{ConfigError, OAuthConfig};
