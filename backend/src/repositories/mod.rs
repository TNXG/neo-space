//! 数据访问层（Repository 模式）
//!
//! 负责所有数据库 CRUD 操作，不包含业务逻辑。

pub mod base;
pub mod account_repository;
pub mod reader_repository;
pub mod options_repository;

pub use account_repository::AccountRepository;
pub use reader_repository::ReaderRepository;
pub use options_repository::OptionsRepository;

// OAuthOptions 将在后续任务中使用
#[allow(unused)]
pub use options_repository::OAuthOptions;
