//! Repository trait 定义
//!
//! 定义通用的 CRUD 接口

use mongodb::Database;
use rocket::http::Status;

/// Repository 基础 trait
#[allow(dead_code)]
pub trait Repository {
    fn database(&self) -> &Database;
}

/// 通用的 CRUD trait
#[allow(dead_code)]
#[async_trait]
pub trait CrudRepository<T>: Repository {
    async fn find_by_id(&self, id: &str) -> Result<T, Status>;
    async fn find_all(&self) -> Result<Vec<T>, Status>;
    async fn insert(&self, item: T) -> Result<T, Status>;
    async fn update(&self, id: &str, item: T) -> Result<T, Status>;
    async fn delete(&self, id: &str) -> Result<(), Status>;
}
