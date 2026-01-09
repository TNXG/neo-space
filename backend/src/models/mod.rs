//! Data models
#![allow(unused)]

pub mod account;
pub mod ai_summary;
pub mod category;
pub mod comment;
pub mod conversions;
pub mod jwt;
pub mod link;
pub mod note;
pub mod options;
pub mod page;
pub mod post;
pub mod realtime;
pub mod recently;
pub mod response;
pub mod time_capsule;
pub mod user;

// Re-export commonly used types
pub use account::{Account, AccountResponse};
pub use ai_summary::AiSummary;
pub use category::Category;
pub use comment::{
    Comment, CommentListResponse, CommentState, CommentTree, CreateCommentRequest,
    UpdateCommentRequest,
};
pub use jwt::JwtClaims;
pub use link::{Link, LinkApplyRequest, LinkState, LinkType};
pub use note::{Note, NoteCount, NoteImage};
pub use options::*;
pub use page::Page;
pub use post::{Post, PostImage, PostWithCategory};
pub use realtime::*;
pub use recently::Recently;
pub use response::{ApiResponse, PaginatedData, PaginatedResponse, Pagination, ResponseStatus};
pub use time_capsule::{TimeCapsule, TimeCapsuleRequest, TimeCapsuleResponse, TimeSensitivity};
pub use user::{GitHubUser, QQUser, Reader, ReaderResponse, User, UserSocialIds};
