//! 第三方服务集成
//!
//! 负责与外部服务的集成，如 OpenAI、Turnstile、OAuth 等。

pub mod openai;
pub mod status;
pub mod turnstile;

// 重新导出所有集成服务
pub use openai::{AiService, ChatMessage, ChatRole};
pub use status::{IpService, LinkHealthService};
pub use turnstile::verify_turnstile;
