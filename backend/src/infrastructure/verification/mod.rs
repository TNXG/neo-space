//! 验证码服务
//!
//! 使用内存缓存存储验证码，支持过期时间和验证次数限制

pub mod service;

pub use service::VerificationService;
