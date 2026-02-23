//! Neo Space Backend Library
//!
//! 这个库导出后端的核心功能，供集成测试和其他模块使用

#[macro_use]
extern crate rocket;

// 导入工具宏到整个 crate
#[macro_use]
mod utils;

mod config;
mod error;
mod guards;
mod models;
mod openapi;
mod routes;
mod services;

// 新增模块（Phase 1: 目录结构重构）
mod bootstrap;
mod infrastructure;
mod integrations;
mod repositories;
mod websocket;

// 重新导出主要的构建函数供测试使用
pub use bootstrap::{build_rocket, init_app};

/// 构建完整的 Rocket 实例（包含所有路由）
/// 用于生产环境和测试环境
///
/// # Panics
/// 如果应用初始化失败，将会 panic
pub async fn build_rocket_with_routes() -> rocket::Rocket<rocket::Build> {
    // 初始化应用组件
    let initialized = match init_app().await {
        Ok(init) => init,
        Err(e) => {
            eprintln!("应用初始化失败: {e}");
            std::process::exit(1);
        }
    };

    // 构建 Rocket 实例（不包含路由）
    let rocket = build_rocket(initialized);

    // 注册路由并返回
    rocket
        .mount("/api/auth", routes::auth::routes())
        .mount("/api/comments", routes::comments::routes())
        .mount("/api/ws", routes::ws::routes())
        .mount("/api/sse", routes::sse::routes())
        .mount(
            "/api/static/artworks",
            routes![
                // 封面缓存文件服务
                routes::artworks::get_artwork,
            ],
        )
        .mount(
            "/api",
            routes![
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
                // Search routes
                routes::search::search,
            ],
        )
}
