//! WebSocket 实时通信
//!
//! 负责 WebSocket 连接管理和事件总线。

pub mod event_bus;
pub mod handler;
pub mod messages;

pub use event_bus::EventBus;
pub use handler::{reader_ws, owner_desktop_ws};
