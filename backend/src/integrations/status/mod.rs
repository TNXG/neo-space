//! 外部状态检测服务

pub mod hosting;
pub mod ip;
pub mod link_health;

pub use ip::IpService;
pub use link_health::LinkHealthService;
