//! Application state and router assembly

use moka::future::Cache;
use mongodb::Database;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use crate::config::AppConfig;
use crate::external::email::EmailService;
use crate::openapi::ApiDoc;
use crate::routes;
use crate::services::ncm_np::NeteaseNowPlayingService;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    /// MongoDB database handle
    pub db: Database,
    /// In-memory cache for frequently accessed data
    pub cache: Cache<String, Vec<u8>>,
    /// Application configuration
    pub config: AppConfig,
    /// Event bus for real-time updates
    pub event_bus: broadcast::Sender<Event>,
    /// HTTP client for external requests
    pub http_client: Client,
    /// Shared email service (preserves verification code cache across requests)
    pub email_service: EmailService,
    /// NetEase Cloud Music now playing service
    pub ncm_np_service: NeteaseNowPlayingService,
}

/// Real-time event types
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum Event {
    /// New comment created
    CommentCreated { id: String },
    /// Comment updated
    CommentUpdated { id: String },
    /// Comment deleted
    CommentDeleted { id: String },
    /// New post created
    PostCreated { id: String },
    /// Post updated
    PostUpdated { id: String },
    /// Link health changed
    LinkHealthChanged { id: String, is_healthy: bool },
}

/// Shared state type alias for convenience
pub type SharedState = Arc<AppState>;

/// Create the application state with all dependencies
pub fn create_state(db: Database, config: AppConfig) -> SharedState {
    tracing::info!("开始初始化应用服务...");

    // Create cache with default settings
    const CACHE_CAPACITY: u64 = 10_000;
    const CACHE_TTL_SECS: u64 = 300;
    let cache = Cache::builder()
        .max_capacity(CACHE_CAPACITY)
        .time_to_live(Duration::from_secs(CACHE_TTL_SECS))
        .build();
    tracing::info!(
        "缓存服务初始化完成 - 容量: {}, TTL: {}秒",
        CACHE_CAPACITY,
        CACHE_TTL_SECS
    );

    // Create event bus with channel size 100
    let (event_bus, _) = broadcast::channel(100);
    tracing::info!("EventBus 初始化完成 - 频道容量: 100");

    // Create HTTP client with default User-Agent
    let default_user_agent = "Mozilla/5.0 (compatible; MaigoStarlightChecker/1.0; +mailto:tnxg@outlook.jp; ) AppleWebKit/99 (KHTML, like Gecko) Chrome/99 MyGO/5 (KiraKira/DokiDoki; Bananice/Protected) Giraffe/4.11 (Wakarimasu/; Haruhikage/Stop)";
    let http_client = match Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent(default_user_agent)
        .build()
    {
        Ok(client) => {
            tracing::info!("HTTP 客户端初始化完成 - 超时: 30秒");
            client
        }
        Err(e) => {
            tracing::error!("Failed to create HTTP client: {}, using default", e);
            Client::builder()
                .user_agent(default_user_agent)
                .build()
                .unwrap_or_else(|_| Client::new())
        }
    };

    // Create shared email service (preserves verification code cache)
    let email_service = EmailService::new(db.clone());
    tracing::info!("邮件服务初始化完成");

    // Create NetEase now playing service
    let ncm_np_service = NeteaseNowPlayingService::new(db.clone());
    tracing::info!("网易云音乐服务初始化完成");

    tracing::info!("所有应用服务初始化完成");

    Arc::new(AppState {
        db,
        cache,
        config,
        event_bus,
        http_client,
        email_service,
        ncm_np_service,
    })
}

/// Build the application router
pub fn create_router(state: SharedState) -> axum::Router {
    use crate::middleware::cors::cors_layer;

    let cors = cors_layer(&state.config.frontend_url, &state.config.backend_url);
    tracing::info!("CORS 配置完成 - 允许来源: {}", state.config.frontend_url);

    // Build API router with nested routes to avoid path conflicts
    let api_router = axum::Router::new()
        .route("/", axum::routing::get(crate::handlers::app_info::app_info))
        .nest("/auth", routes::auth::routes())
        .nest(
            "/posts",
            routes::post::routes().merge(routes::admin_posts::routes()),
        )
        .nest(
            "/notes",
            routes::note::routes().merge(routes::admin_notes::routes()),
        )
        .nest(
            "/comments",
            routes::comment::routes().merge(routes::admin_comments::routes()),
        )
        .nest(
            "/links",
            routes::link::routes().merge(routes::admin_links::routes()),
        )
        .nest("/user", routes::user::routes())
        .nest("/pages", routes::pages::routes())
        .nest("/categories", routes::categories::routes())
        .nest("/says", routes::says::routes())
        .nest("/recently", routes::recently::routes())
        .nest("/topics", routes::topics::routes())
        .nest("/snippets", routes::snippets::routes())
        .nest("/projects", routes::projects::routes())
        .nest("/drafts", routes::drafts::routes())
        .nest("/options", routes::options::routes())
        .nest("/owner", routes::owner::routes())
        .nest("/ai", routes::ai_admin::routes())
        .nest("/files", routes::files::routes())
        .merge(routes::admin_misc::routes())
        .merge(routes::misc::routes());

    // WebSocket routes
    let ws_router = axum::Router::new().nest("/ws", routes::ws::routes());

    // Health check router (stateless, no /api prefix)
    let health_router = routes::health::routes();

    // Static files route (no /api prefix)
    let static_router = axum::Router::new().route(
        "/api/static/artworks/{filename}",
        axum::routing::get(crate::handlers::artwork::serve_artwork),
    );

    // Combine all routes
    let mut router = axum::Router::new()
        .nest("/api", api_router)
        .merge(ws_router)
        .merge(static_router)
        .merge(health_router)
        .merge(SwaggerUi::new("/api-docs-ui").url("/api-docs/openapi.json", ApiDoc::openapi()));

    if let Some(admin_router) = crate::admin_dashboard::mounted_router(&state) {
        router = router.merge(admin_router);
    }

    router
        .fallback(crate::error::fallback_404)
        .layer(axum::middleware::from_fn(
            crate::middleware::request_log::log_request,
        ))
        .layer(tower_http::compression::CompressionLayer::new())
        .layer(cors)
        .with_state(state)
}
