//! OAuth service

pub mod github;
pub mod qq;
pub mod service;

pub use service::{OAuthService, OAuthUserInfo};
