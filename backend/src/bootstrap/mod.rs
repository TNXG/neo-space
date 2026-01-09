//! 应用初始化模块
//!
//! 负责应用的启动、配置加载、数据库初始化和服务初始化。

pub mod app;
pub mod config;
pub mod database;
pub mod services;

pub use app::{build_rocket, init_app};
pub use config::load_config;
pub use database::init_database;
pub use services::{init_services, AppServices};
