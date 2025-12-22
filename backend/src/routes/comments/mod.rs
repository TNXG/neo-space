//! 评论路由模块

pub mod list;
pub mod create;
pub mod update;
pub mod delete;
pub mod admin;

use rocket::Route;

/// 获取所有评论相关的路由
pub fn routes() -> Vec<Route> {
    routes![
        // 基础 CRUD 操作
        list::list_comments,
        create::create_comment,
        update::update_comment,
        delete::delete_comment,
        // 管理员操作
        admin::hide_comment,
        admin::unhide_comment,
        admin::pin_comment,
        admin::unpin_comment,
    ]
}