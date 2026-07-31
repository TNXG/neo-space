//! Application state and router assembly

use arc_swap::ArcSwap;
use moka::future::Cache;
use mongodb::Database;
use reqwest::Client;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::broadcast;

use crate::config::AppConfig;
use crate::external::email::EmailService;
use crate::openapi::ApiDoc;
use crate::routes;
use crate::services::ncm_np::NeteaseNowPlayingService;
use crate::services::passkey::PasskeyService;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    /// MongoDB database handle
    pub db: Database,
    /// In-memory cache for frequently accessed data
    pub cache: Cache<String, Vec<u8>>,
    /// 友链健康状态刷新周期较长，需要独立缓存避免被通用短 TTL 提前清掉
    pub link_health_cache: Cache<String, Vec<u8>>,
    /// Application configuration
    pub config: Arc<ArcSwap<AppConfig>>,
    /// 配置变更通知；后台任务可据此立即重建调度周期
    pub config_events: broadcast::Sender<()>,
    /// Event bus for real-time updates
    pub event_bus: broadcast::Sender<Event>,
    /// HTTP client for external requests
    pub http_client: Client,
    /// Shared email service (preserves verification code cache across requests)
    pub email_service: EmailService,
    /// NetEase Cloud Music now playing service
    pub ncm_np_service: NeteaseNowPlayingService,
    /// Passkey 服务；仅在 BACKEND_URL 可作为合法 WebAuthn Origin 时启用
    pub passkey_service: Arc<RwLock<Option<PasskeyService>>>,
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

impl AppState {
    /// 返回当前运行时配置的一致性快照。
    pub fn config(&self) -> arc_swap::Guard<Arc<AppConfig>> {
        self.config.load()
    }

    /// 从数据库重新加载配置，并应用环境变量的最高优先级覆盖。
    pub async fn reload_runtime_config(&self) {
        let previous = self.config.load_full();
        let mut next = (*previous).clone();
        crate::config::runtime::apply_database_options(&self.db, &mut next).await;

        if previous.backend_url != next.backend_url {
            let next_passkey_service = PasskeyService::from_backend_url(&next.backend_url);
            match self.passkey_service.write() {
                Ok(mut passkey_service) => *passkey_service = next_passkey_service,
                Err(error) => tracing::error!(%error, "Passkey 配置锁已损坏，无法热更新"),
            }
        }

        self.config.store(Arc::new(next));
        let _ = self.config_events.send(());
    }

    /// 获取当前 Passkey 服务快照，避免在请求期间持有同步锁。
    pub fn passkey_service(&self) -> Option<PasskeyService> {
        self.passkey_service
            .read()
            .map(|passkey_service| passkey_service.clone())
            .unwrap_or_else(|error| {
                tracing::error!(%error, "Passkey 配置锁已损坏");
                None
            })
    }
}

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

    let link_health_interval_hours = config.link_health_interval_hours;
    let link_health_cache_ttl_secs = (link_health_interval_hours + 1) * 3600;
    let link_health_cache = Cache::builder()
        .max_capacity(CACHE_CAPACITY)
        .time_to_live(Duration::from_secs(link_health_cache_ttl_secs))
        .build();
    tracing::info!(
        "友链健康缓存初始化完成 - 容量: {}, TTL: {}秒",
        CACHE_CAPACITY,
        link_health_cache_ttl_secs
    );

    // Create event bus with channel size 100
    let (event_bus, _) = broadcast::channel(100);
    let (config_events, _) = broadcast::channel(16);
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

    let passkey_service = PasskeyService::from_backend_url(&config.backend_url);
    tracing::info!(
        enabled = passkey_service.is_some(),
        "Passkey 服务初始化完成"
    );

    tracing::info!("所有应用服务初始化完成");

    Arc::new(AppState {
        db,
        cache,
        link_health_cache,
        config: Arc::new(ArcSwap::from_pointee(config)),
        config_events,
        event_bus,
        http_client,
        email_service,
        ncm_np_service,
        passkey_service: Arc::new(RwLock::new(passkey_service)),
    })
}

/// Build the application router
pub fn create_router(state: SharedState) -> axum::Router {
    use crate::middleware::cors::cors_layer;

    let cors = cors_layer(state.config.clone());
    tracing::info!(
        "CORS 动态配置完成 - 允许来源: {}",
        state.config().frontend_url
    );

    // Build API router with nested routes to avoid path conflicts
    let api_router = axum::Router::new()
        .route("/", axum::routing::get(crate::handlers::app_info::app_info))
        .nest("/auth", routes::auth::routes())
        .nest("/bangumi", routes::bangumi::routes())
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
        .nest("/admin/meilisearch", routes::meilisearch_admin::routes())
        .nest("/files", routes::files::routes())
        .merge(routes::admin_dashboard::routes())
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
