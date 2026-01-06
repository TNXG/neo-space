//! 数据库工具宏和函数
//!
//! 提供统一的数据库操作辅助工具，减少重复代码。

use mongodb::bson::oid::ObjectId;
use rocket::http::Status;
use std::str::FromStr;

/// 统一的 ObjectId 解析
///
/// # 参数
/// * `id` - 要解析的字符串 ID
///
/// # 返回
/// * `Ok(ObjectId)` - 解析成功
/// * `Err(Status)` - 解析失败，返回 BadRequest
pub fn parse_object_id(id: &str) -> Result<ObjectId, Status> {
    ObjectId::from_str(id).map_err(|_| {
        log::warn!("无效的 ObjectId: {id}");
        Status::BadRequest
    })
}

/// 数据库错误处理宏
#[macro_export]
macro_rules! db_result {
    ($expr:expr) => {
        $expr.await.map_err(|e| {
            log::error!("Database error: {e:?}");
            rocket::http::Status::InternalServerError
        })
    };
}

/// 查找单个文档的宏
#[macro_export]
macro_rules! db_find_one {
    ($collection:expr, $filter:expr) => {{
        match $crate::db_result!($collection.find_one($filter)) {
            Ok(Some(doc)) => Ok(doc),
            Ok(None) => Err(rocket::http::Status::NotFound),
            Err(e) => Err(e),
        }
    }};
}