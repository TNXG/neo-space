//! Configuration modules

pub mod email;
pub mod settings;

pub use email::{SmtpEncryption, get_email_config};
pub use settings::{ConfigError, OAuthConfig};
