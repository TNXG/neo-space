#[macro_use]
extern crate rocket;

mod config;
mod models;
mod routes;
mod services;
mod utils;
mod guards;
mod error;

use rocket::http::Method;
use rocket::serde::json::Json;
use rocket::Request;
use rocket_cors::{AllowedOrigins, CorsOptions};
use models::ApiResponse;

/// 404 Not Found error catcher - returns JSON
#[catch(404)]
fn not_found(_req: &Request) -> Json<ApiResponse<()>> {
    ApiResponse::not_found("Resource not found".to_string())
}

/// 500 Internal Server Error catcher - returns JSON
#[catch(500)]
fn internal_error(_req: &Request) -> Json<ApiResponse<()>> {
    ApiResponse::internal_error("Internal server error".to_string())
}

#[launch]
async fn rocket() -> _ {
    // 加载 .env 文件（必须在所有环境变量读取之前）
    dotenv::dotenv().ok();
    
    // 初始化日志系统（设置默认日志级别为 info）
    if std::env::var("RUST_LOG").is_err() {
        std::env::set_var("RUST_LOG", "info");
    }
    env_logger::init();
    log::info!("启动 Rocket 服务器...");

    // 加载 OAuth 配置（仅作为后备配置，实际使用时从数据库读取）
    let oauth_config = config::OAuthConfig::from_env()
        .expect("Failed to load OAuth configuration from environment variables");
    log::info!("OAuth 后备配置从环境变量加载成功");

    // Initialize database connection
    let database = services::init_db().await.expect("Failed to connect to MongoDB");
    log::info!("MongoDB 连接成功");

    // Initialize IP service
    // 获取当前工作目录的绝对路径
    let current_dir = std::env::current_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    
    let ipv4_db_path = std::env::var("IP2REGION_V4_DB")
        .unwrap_or_else(|_| {
            current_dir.join("data/ip2region_v4.xdb")
                .to_string_lossy()
                .to_string()
        });
    let ipv6_db_path = std::env::var("IP2REGION_V6_DB")
        .unwrap_or_else(|_| {
            current_dir.join("data/ip2region_v6.xdb")
                .to_string_lossy()
                .to_string()
        });
    
    let ip_service = match services::IpService::new(ipv4_db_path.clone(), ipv6_db_path.clone()) {
        Ok(service) => {
            log::info!("IP2Region 服务初始化成功");
            log::info!("  - IPv4 数据库: {}", ipv4_db_path);
            log::info!("  - IPv6 数据库: {}", ipv6_db_path);
            Some(service)
        }
        Err(e) => {
            log::warn!("IP2Region 服务初始化失败: {}", e);
            log::warn!("IP 地理位置查询功能将不可用");
            log::warn!("当前工作目录: {}", current_dir.display());
            log::warn!("请下载数据库文件到以下位置:");
            log::warn!("  - {}", current_dir.join("data/ip2region_v4.xdb").display());
            log::warn!("  - {}", current_dir.join("data/ip2region_v6.xdb").display());
            log::warn!("下载地址: https://github.com/lionsoul2014/ip2region/tree/master/data");
            log::warn!("或运行脚本: bash scripts/download-ip2region.sh");
            None
        }
    };

    // Configure CORS for frontend communication
    let cors = CorsOptions::default()
        .allowed_origins(AllowedOrigins::all())
        .allowed_methods(
            vec![Method::Get, Method::Post, Method::Put, Method::Delete, Method::Patch]
                .into_iter()
                .map(From::from)
                .collect(),
        )
        .allowed_headers(rocket_cors::AllowedHeaders::some(&[
            "Authorization",
            "Content-Type",
            "Accept",
        ]))
        .allow_credentials(true)
        .to_cors()
        .expect("Failed to create CORS");
    log::info!("CORS 配置完成");

    // Build and launch Rocket with modular route registration
    rocket::build()
        .manage(database)
        .manage(oauth_config)
        .manage(ip_service)
        .attach(cors)
        .register("/", catchers![not_found, internal_error])
        .mount("/api/auth", routes::auth::routes())
        .mount("/api/comments", routes::comments::routes())
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
