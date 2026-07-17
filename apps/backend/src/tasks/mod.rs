//! Background tasks module

pub mod content_change;
pub mod isr;
pub mod link_health;
pub mod link_health_check;
pub mod meilisearch_sync;
pub mod netease_now_playing;

pub use link_health::{run_link_health_check, start_link_health_task};
pub use meilisearch_sync::full_sync;
pub use netease_now_playing::start_netease_now_playing_task;
