//! 基础设施服务层
//!
//! 负责缓存、邮件、数据库连接池等基础设施服务。

pub mod cache;
pub mod database;
pub mod email;
pub mod revalidation;
pub mod verification;

// 重新导出所有基础设施服务
pub use cache::CacheService;
pub use database::ChangeStreamService;
pub use email::send_verification_email;
pub use revalidation::RevalidationService;
pub use verification::VerificationService;
