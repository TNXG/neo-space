//! WebSocket 实时通信基础设施
//!
//! 提供事件总线，供 services 和 routes 使用
//! 消息类型定义已迁移到 models/realtime.rs

pub mod event_bus;

pub use event_bus::EventBus;
