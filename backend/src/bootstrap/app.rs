//! 应用构建器
//!
//! 负责构建 Rocket 应用实例

use mongodb::Database;
use rocket::http::Method;
use rocket_cors::{AllowedOrigins, CorsOptions};
use crate::config::OAuthConfig;
use crate::models::ApiResponse;
use crate::openapi::ApiDoc;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use rocket::Rocket;

use super::{load_config, init_database, init_services, AppServices};

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

    Ok(AppInitialized {
        database,
        oauth_config,
        app_services,
        cors,
    })
}

/// 构建带有所有管理状态的 Rocket 实例
pub fn build_rocket(init: AppInitialized) -> Rocket<rocket::Build> {
    let AppInitialized {
        database,
        oauth_config,
        app_services,
        cors,
    } = init;

    rocket::build()
        .manage(database)
        .manage(oauth_config)
        .manage(app_services.ip)
        .manage(app_services.cache)
        .manage(app_services.link_health)
        .manage(app_services.verification)
        .manage(app_services.jwt_verifier)
        .attach(cors)
        .register("/", catchers![not_found, internal_error])
        .mount(
            "/",
            SwaggerUi::new("/swagger-ui/<_..>")
                .url("/api-docs/openapi.json", ApiDoc::openapi()),
        )
}

/// 初始化日志系统
fn init_logging() {
    // 加载 .env 文件（必须在所有环境变量读取之前）
    dotenv::dotenv().ok();

    // 设置默认日志级别
    if std::env::var("RUST_LOG").is_err() {
        std::env::set_var("RUST_LOG", "info");
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
}