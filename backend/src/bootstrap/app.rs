//! 应用构建器
//!
//! 负责构建 Rocket 应用实例

use crate::config::OAuthConfig;
use crate::models::ApiResponse;
use crate::openapi::ApiDoc;
use crate::websocket::EventBus;
use mongodb::Database;
use rocket::Rocket;
use rocket::http::Method;
use rocket_cors::{AllowedOrigins, CorsOptions};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use super::{AppServices, init_database, init_services, load_config};

/// 404 Not Found error catcher
#[catch(404)]
fn not_found(_req: &rocket::Request) -> rocket::serde::json::Json<ApiResponse<()>> {
    ApiResponse::not_found("Resource not found".to_string())
}

/// 500 Internal Server Error catcher
#[catch(500)]
fn internal_error(_req: &rocket::Request) -> rocket::serde::json::Json<ApiResponse<()>> {
    ApiResponse::internal_error("Internal server error".to_string())
}

/// 应用初始化结果
pub struct AppInitialized {
    pub database: Database,
    pub oauth_config: OAuthConfig,
    pub app_services: AppServices,
    pub cors: rocket_cors::Cors,
    pub event_bus: EventBus,
}

/// 初始化应用组件
///
/// 初始化日志、配置、数据库和服务，返回所有初始化的组件
pub async fn init_app() -> Result<AppInitialized, Box<dyn std::error::Error>> {
    // 1. 初始化日志
    init_logging();

    // 2. 加载配置
    let oauth_config = load_config()?;
    log::info!("OAuth 后备配置从环境变量加载成功");

    // 3. 初始化数据库
    let database = init_database().await?;
    log::info!("MongoDB 连接成功");

    // 4. 初始化所有服务
    let app_services = init_services(database.clone(), &oauth_config).await;

    // 5. 配置 CORS
    let cors = configure_cors()?;
    log::info!("CORS 配置完成");

    // 6. 初始化 EventBus
    let event_bus = EventBus::new();
    log::info!("EventBus 初始化完成");

    // 7. 初始化缓存目录
    init_cache_dirs()?;

    Ok(AppInitialized {
        database,
        oauth_config,
        app_services,
        cors,
        event_bus,
    })
}

/// 初始化缓存目录
fn init_cache_dirs() -> Result<(), Box<dyn std::error::Error>> {
    let artwork_cache_dir = std::path::Path::new("./cache/artworks");
    if !artwork_cache_dir.exists() {
        std::fs::create_dir_all(artwork_cache_dir)?;
        log::info!("创建封面缓存目录: {}", artwork_cache_dir.display());
    }
    Ok(())
}

/// 构建带有所有管理状态的 Rocket 实例
#[must_use]
pub fn build_rocket(init: AppInitialized) -> Rocket<rocket::Build> {
    let AppInitialized {
        database,
        oauth_config,
        app_services,
        cors,
        event_bus,
    } = init;

    rocket::build()
        .manage(database)
        .manage(oauth_config)
        .manage(app_services.ip)
        .manage(app_services.cache)
        .manage(app_services.link_health)
        .manage(app_services.verification)
        .manage(app_services.jwt_verifier)
        .manage(app_services.search)
        .manage(event_bus)
        .attach(cors)
        .register("/", catchers![not_found, internal_error])
        .mount(
            "/",
            SwaggerUi::new("/swagger-ui/<_..>").url("/api-docs/openapi.json", ApiDoc::openapi()),
        )
}

/// 初始化日志系统
fn init_logging() {
    // 加载 .env 文件（必须在所有环境变量读取之前）
    dotenv::dotenv().ok();

    // 设置默认日志级别
    if std::env::var("RUST_LOG").is_err() {
        // SAFETY: 在单线程初始化阶段设置环境变量是安全的
        // 这发生在任何其他线程启动之前
        unsafe {
            std::env::set_var("RUST_LOG", "info");
        }
    }

    // 使用 try_init 避免在测试中重复初始化 logger
    if env_logger::try_init().is_ok() {
        log::info!("启动 Rocket 服务器...");
    }
}

/// 配置 CORS
fn configure_cors() -> Result<rocket_cors::Cors, rocket_cors::Error> {
    CorsOptions::default()
        .allowed_origins(AllowedOrigins::all())
        .allowed_methods(
            vec![
                Method::Get,
                Method::Post,
                Method::Put,
                Method::Delete,
                Method::Patch,
            ]
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
}
