//! Data models

pub mod response;
pub mod post;
pub mod note;
pub mod category;
pub mod link;
pub mod page;
pub mod recently;
pub mod user;
pub mod options;
pub mod ai_summary;
pub mod time_capsule;

// Re-export commonly used types
pub use response::{ApiResponse, ResponseStatus, Pagination, PaginatedData, PaginatedResponse};
pub use post::{Post, PostWithCategory, PostImage};
pub use note::{Note, NoteImage, NoteCount};
pub use category::Category;
pub use link::Link;
pub use page::Page;
pub use recently::Recently;
pub use user::{User, UserSocialIds, Reader};
pub use options::*;
pub use ai_summary::AiSummary;
pub use time_capsule::{TimeCapsule, TimeCapsuleRequest, TimeCapsuleResponse, TimeSensitivity};
