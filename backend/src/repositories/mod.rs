//! 数据访问层（Repository 模式）
//!
//! 负责所有数据库 CRUD 操作，不包含业务逻辑。

pub mod account_repository;
pub mod base;
pub mod options_repository;
pub mod reader_repository;

pub use account_repository::AccountRepository;
pub use options_repository::OptionsRepository;
pub use reader_repository::ReaderRepository;

// OAuthOptions 将在后续任务中使用
#[allow(unused)]
pub use options_repository::OAuthOptions;
