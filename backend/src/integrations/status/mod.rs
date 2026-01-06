//! 外部状态检测服务

pub mod hosting;
pub mod link_health;
pub mod ip;

pub use link_health::LinkHealthService;
pub use ip::IpService;
