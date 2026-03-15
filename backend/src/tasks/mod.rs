//! Background tasks module

pub mod change_stream;
pub mod isr;
pub mod link_health;
pub mod link_health_check;
pub mod meilisearch_sync;
pub mod netease_now_playing;

pub use change_stream::start_change_stream_task;
pub use link_health::start_link_health_task;
pub use netease_now_playing::start_netease_now_playing_task;
