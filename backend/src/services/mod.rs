//! Service modules - 业务逻辑服务层
//!
//! 核心业务逻辑保留在此模块，基础设施服务和第三方集成已迁移：
//! - infrastructure/: 缓存、邮件、数据库、revalidation
//! - integrations/: OpenAI、Turnstile、状态检测

// ===== 核心业务逻辑模块 =====

pub mod options_service;
pub mod spam_detector;

pub mod auth;
pub mod comment;
pub mod realtime;

// ===== OAuth 服务（已迁移到 auth/oauth）=====

// 导出新的统一 OAuth 服务
pub use crate::services::auth::oauth::{OAuthProviderType, OAuthService, OAuthUserInfo};

// ===== 重新导出基础设施服务 =====

pub use crate::infrastructure::{
    CacheService, ChangeStreamService, RevalidationService, VerificationService,
};

// ===== 重新导出第三方集成服务 =====

pub use crate::integrations::{verify_turnstile, AiService, ChatMessage, ChatRole, IpService};

// ===== 公共导出 =====

pub use comment::service::CommentService;
pub use options_service::get_site_config;
pub use realtime::{OwnerWebSocketService, ReaderSSEService};
pub use spam_detector::SpamDetector;
