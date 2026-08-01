//! Data models

pub mod account;
pub mod bangumi;
pub mod comment;
pub mod common;
pub mod content;
pub mod extended;
pub mod link;
pub mod options;
pub mod passkey;
pub mod reader;
pub mod realtime;
pub mod search_management;
pub mod search_vector;
pub mod serializers;
pub mod user;

// Re-export commonly used types
pub use bangumi::{BangumiImageCrop, UpsertBangumiImageCrop};
pub use comment::{Comment, CommentState, CommentTree, UpdateCommentRequest};
pub use common::{ApiResponse, PaginatedData, Pagination, ResponseStatus};
pub use content::{
    AiSummary, AiTranslation, Category, Note, Page, Post, PostWithCategory, Recently,
    TranslationEntry,
};
pub use extended::{Draft, DraftHistoryEntry, Project, Say, Snippet, Topic};
pub use link::{
    Link, LinkApplyRequest, LinkHealthStatus, LinkState, LinkType, LinkWithHealth, SendCodeRequest,
};
pub use passkey::{PasskeySummary, StoredPasskey};
pub use search_management::{
    SearchMaintenanceSchedule, SearchMaintenanceScheduleResponse, SearchMaintenanceTask,
    SearchMaintenanceTaskResponse, SearchSyncEvent, SearchSyncEventResponse,
    UpdateSearchMaintenanceSchedule,
};
pub use search_vector::{SearchVectorConfig, SearchVectorConfigResponse, UpdateSearchVectorConfig};
pub use user::{Account, AccountResponse, GitHubUser, Reader, ReaderResponse, User, UserSocialIds};
