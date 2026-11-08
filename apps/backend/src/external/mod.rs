//! External service integrations

pub mod ai;
pub mod captcha;
pub mod email;
pub mod email_templates;
pub mod ip_location;
pub mod jev;
pub mod network;
#[cfg(test)]
#[path = "../../tests/unit/network.rs"]
mod network_tests;
pub mod meilisearch_admin;
pub mod search;
