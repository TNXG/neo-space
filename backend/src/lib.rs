//! Neo Space Backend Library
//! 
//! 这个库导出后端的核心功能，供集成测试和其他模块使用

#[macro_use]
extern crate rocket;

// 导入工具宏到整个 crate
#[macro_use]
mod utils;

mod config;
mod models;
mod routes;
mod services;
mod guards;
mod error;
mod openapi;

// 新增模块（Phase 1: 目录结构重构）
mod bootstrap;
mod repositories;
mod infrastructure;
mod integrations;
mod websocket;

// 重新导出主要的构建函数供测试使用
pub use bootstrap::{init_app, build_rocket};

/// 构建完整的 Rocket 实例（包含所有路由）
/// 用于生产环境和测试环境
pub async fn build_rocket_with_routes() -> rocket::Rocket<rocket::Build> {
    // 初始化应用组件
    let initialized = init_app().await.expect("应用初始化失败");

    // 构建 Rocket 实例（不包含路由）
    let rocket = build_rocket(initialized);

    // 注册路由并返回
    rocket
        .mount("/api/auth", routes::auth::routes())
        .mount("/api/comments", routes::comments::routes())
        .mount("/api/presence", routes![
            // WebSocket routes - 实时在线状态和活动广播
            websocket::reader_ws,
            websocket::owner_desktop_ws,
        ])
        .mount("/api/static/artworks", routes![
            // 封面缓存文件服务
            routes::artworks::get_artwork,
        ])
        .mount("/api", routes![
            // Posts routes
            routes::posts::list_posts,
            routes::posts::get_post_by_id,
            routes::posts::get_post_by_slug,
            routes::posts::get_adjacent_posts,
            // Notes routes
            routes::notes::list_notes,
            routes::notes::get_note_by_id,
            routes::notes::get_note_by_nid,
            routes::notes::get_adjacent_notes,
            // Categories routes
            routes::categories::list_categories,
            // Links routes
            routes::links::list_links,
            routes::links::get_link,
            routes::links::apply_link,
            routes::links::send_verification_code,
            // Recentlies (Moments) routes
            routes::recentlies::list_recentlies,
            // Users routes
            routes::users::get_user_profile,
            routes::users::list_readers,
            routes::users::get_reader_by_id,
            // Nbnhhsh routes
            routes::nbnhhsh::guess,
            // Pages routes
            routes::pages::get_page_by_slug,
            // Config routes
            routes::config::get_site_config,
            // AI routes
            routes::ai::analyze_time_capsule,
            routes::ai::get_time_capsule,
        ])
}
