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
use models::{ApiResponse, ResponseStatus};

/// 404 Not Found error catcher - returns JSON
#[catch(404)]
fn not_found(_req: &Request) -> Json<ApiResponse<()>> {
    Json(ApiResponse {
        code: 404,
        status: ResponseStatus::Failed,
        message: "Resource not found".to_string(),
        data: (),
    })
}

/// 500 Internal Server Error catcher - returns JSON
#[catch(500)]
fn internal_error(_req: &Request) -> Json<ApiResponse<()>> {
    Json(ApiResponse {
        code: 500,
        status: ResponseStatus::Failed,
        message: "Internal server error".to_string(),
        data: (),
    })
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
