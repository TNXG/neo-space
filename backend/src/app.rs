//! Application state and router assembly

use moka::future::Cache;
use mongodb::Database;
use reqwest::Client;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::broadcast;

use crate::config::AppConfig;
use crate::external::email::EmailService;
use crate::handlers;
use crate::openapi::ApiDoc;
use crate::realtime;
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

    tracing::info!("所有应用服务初始化完成");

    Arc::new(AppState {
        db,
        cache,
        config,
        event_bus,
        http_client,
        email_service,
    })
}

/// Build the application router
pub fn create_router(state: SharedState) -> axum::Router {
    use crate::middleware::cors::cors_layer;

    let cors = cors_layer(&state.config.frontend_url, &state.config.backend_url);
    tracing::info!("CORS 配置完成 - 允许来源: {}", state.config.frontend_url);

    // Health check endpoint (no auth required)
    let health_router = axum::Router::new().route("/health", axum::routing::get(health_check));

    // API v1 routes
    let api_router = axum::Router::new()
        // Auth routes
        .route(
            "/auth/me",
            axum::routing::get(handlers::auth::get_current_user),
        )
        .route(
            "/auth/oauth/github",
            axum::routing::get(handlers::oauth::github_oauth),
        )
        .route(
            "/auth/oauth/github/callback",
            axum::routing::get(handlers::oauth::github_callback),
        )
        .route(
            "/auth/oauth/qq",
            axum::routing::get(handlers::oauth::qq_oauth),
        )
        .route(
            "/auth/oauth/qq/callback",
            axum::routing::get(handlers::oauth::qq_callback),
        )
        .route(
            "/auth/bindable-identities",
            axum::routing::get(handlers::oauth::get_bindable_identities),
        )
        .route(
            "/auth/bind-anonymous",
            axum::routing::post(handlers::oauth::bind_anonymous),
        )
        .route(
            "/auth/skip-bind",
            axum::routing::post(handlers::oauth::skip_bind),
        )
        .route(
            "/auth/accounts",
            axum::routing::get(handlers::auth::get_user_accounts),
        )
        .route(
            "/auth/avatar",
            axum::routing::put(handlers::auth::update_user_avatar),
        )
        // Post routes
        .route("/posts", axum::routing::get(handlers::post::list_posts))
        .route("/posts/{id}", axum::routing::get(handlers::post::get_post))
        .route(
            "/posts/slug/{slug}",
            axum::routing::get(handlers::post::get_post_by_slug),
        )
        .route(
            "/posts/slug/{slug}/adjacent",
            axum::routing::get(handlers::post::get_adjacent_posts),
        )
        // Note routes
        .route("/notes", axum::routing::get(handlers::note::list_notes))
        .route("/notes/{id}", axum::routing::get(handlers::note::get_note))
        .route(
            "/notes/nid/{nid}",
            axum::routing::get(handlers::note::get_note_by_nid),
        )
        .route(
            "/notes/nid/{nid}/adjacent",
            axum::routing::get(handlers::note::get_adjacent_notes),
        )
        // Page routes
        .route(
            "/pages/{slug}",
            axum::routing::get(handlers::page::get_page_by_slug),
        )
        // Comment routes
        .route(
            "/comments",
            axum::routing::get(handlers::comment::list_comments),
        )
        .route(
            "/comments",
            axum::routing::post(handlers::comment::create_comment),
        )
        .route(
            "/comments/{id}",
            axum::routing::put(handlers::admin::comment::update_comment),
        )
        .route(
            "/comments/{id}",
            axum::routing::delete(handlers::admin::comment::delete_comment),
        )
        .route(
            "/comments/{id}/hide",
            axum::routing::patch(handlers::admin::comment::hide_comment),
        )
        .route(
            "/comments/{id}/hide",
            axum::routing::delete(handlers::admin::comment::unhide_comment),
        )
        .route(
            "/comments/{id}/pin",
            axum::routing::patch(handlers::admin::comment::pin_comment),
        )
        .route(
            "/comments/{id}/pin",
            axum::routing::delete(handlers::admin::comment::unpin_comment),
        )
        // Link routes
        .route("/links", axum::routing::get(handlers::link::list_links))
        .route("/links/{id}", axum::routing::get(handlers::link::get_link))
        .route(
            "/links/send-code",
            axum::routing::post(handlers::link::send_verification_code),
        )
        .route(
            "/links/apply",
            axum::routing::post(handlers::link::apply_link),
        )
        // Artwork route
        .route(
            "/artworks/{filename}",
            axum::routing::get(handlers::artwork::serve_artwork),
        )
        // User/readers routes
        .route(
            "/user/profile",
            axum::routing::get(handlers::users::get_owner_profile),
        )
        .route(
            "/readers",
            axum::routing::get(handlers::users::list_readers_public),
        )
        .route(
            "/readers/{id}",
            axum::routing::get(handlers::users::get_reader_by_id_public),
        )
        .route(
            "/users",
            axum::routing::get(handlers::admin::users::list_users),
        )
        .route(
            "/users/handle/check",
            axum::routing::get(handlers::users::check_handle_availability),
        )
        .route(
            "/users/avatar",
            axum::routing::post(handlers::users::update_avatar),
        )
        .route(
            "/users/profile",
            axum::routing::patch(handlers::users::update_user_profile),
        )
        .route(
            "/users/{id}",
            axum::routing::get(handlers::admin::users::get_user_by_id),
        )
        .route(
            "/users/{id}",
            axum::routing::delete(handlers::admin::users::delete_user),
        )
        .route(
            "/users/{id}/accounts",
            axum::routing::get(handlers::admin::users::list_user_accounts),
        )
        .route(
            "/users/{id}/accounts/{account_id}",
            axum::routing::delete(handlers::admin::users::delete_user_account),
        )
        .route(
            "/users/email/{email}",
            axum::routing::get(handlers::admin::users::get_user_by_email),
        )
        // Config and misc routes
        .route("/config", axum::routing::get(handlers::misc::get_config))
        .route(
            "/recentlies",
            axum::routing::get(handlers::misc::list_recentlies),
        )
        .route(
            "/categories",
            axum::routing::get(handlers::misc::list_categories),
        )
        .route(
            "/nbnhhsh/guess",
            axum::routing::post(handlers::misc::nbnhhsh_guess),
        )
        // Search route
        .route("/search", axum::routing::get(handlers::search::search))
        // AI routes
        .route(
            "/ai/time-capsule",
            axum::routing::post(handlers::ai::analyze_time_capsule),
        )
        .route(
            "/ai/time-capsule/{ref_id}",
            axum::routing::get(handlers::ai::get_time_capsule),
        )
        .with_state(state.clone());

    // WebSocket routes
    let ws_router = axum::Router::new()
        .route(
            "/ws/owner-desktop",
            axum::routing::get(realtime::owner_desktop_ws),
        )
        .route(
            "/ws/reader",
            axum::routing::get(realtime::reader_ws),
        )
        .with_state(state.clone());

    // Static files router (no /api prefix)
    let static_router = axum::Router::new().route(
        "/api/static/artworks/{filename}",
        axum::routing::get(handlers::artwork::serve_artwork),
    );

    // Combine all routes
    axum::Router::new()
        .merge(health_router)
        .nest("/api", api_router)
        .merge(ws_router)
        .merge(static_router)
        .merge(SwaggerUi::new("/api-docs-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .fallback(crate::error::fallback_404)
        .layer(axum::middleware::from_fn(
            crate::middleware::request_log::log_request,
        ))
        .layer(tower_http::compression::CompressionLayer::new())
        .layer(cors)
        .with_state(state)
}

/// Simple health check endpoint
#[utoipa::path(
    get,
    path = "/health",
    responses(
        (status = 200, description = "Health check successful")
    ),
    tag = "health"
)]
pub async fn health_check() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({
        "status": "healthy",
        "timestamp": chrono::Utc::now().to_rfc3339()
    }))
}
