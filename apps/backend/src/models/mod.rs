//! Data models

pub mod account;
pub mod comment;
pub mod common;
pub mod content;
pub mod extended;
pub mod link;
pub mod options;
pub mod reader;
pub mod realtime;
pub mod serializers;
pub mod user;

// Re-export commonly used types
pub use comment::{Comment, CommentState, CommentTree, UpdateCommentRequest};
pub use common::{ApiResponse, PaginatedData, Pagination, ResponseStatus};
pub use content::{
    AiSummary, AiTranslation, Category, Note, Page, Post, PostWithCategory, Recently,
    TranslationEntry,
};
pub use extended::{
    ApiToken, CronTaskRecord, Draft, Project, Say, Snippet, Subscriber, Topic, Webhook,
};
pub use link::{
    Link, LinkApplyRequest, LinkHealthStatus, LinkState, LinkType, LinkWithHealth, SendCodeRequest,
};
pub use user::{Account, AccountResponse, GitHubUser, Reader, ReaderResponse, User, UserSocialIds};
