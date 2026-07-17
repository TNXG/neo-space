//! Axum Backend for Neo-Space
//!
//! A modern web backend built with Axum framework.

mod admin_dashboard;
mod app;
mod auth;
mod config;
mod error;
mod external;
mod handlers;
mod middleware;
mod models;
mod openapi;
mod realtime;
mod routes;
mod services;
mod tasks;

use axum::Router;
use config::{AppConfig, database};
use std::net::SocketAddr;
use tokio::signal;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Install rustls CryptoProvider (required by jsonwebtoken 10.x and other rustls users)
    if let Err(_e) = rustls::crypto::ring::default_provider().install_default() {
        return Err(
            "Failed to install rustls ring CryptoProvider: another provider was already installed"
                .into(),
        );
    }

    // Load .env file if present
    dotenv::dotenv().ok();

    // Initialize tracing
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_target(false)
        .init();

    info!("Starting Neo-Space Axum Backend...");

    // Load configuration
    let mut config = AppConfig::from_env()?;
    info!("Configuration loaded successfully");

    // Initialize database
    let db = database::init_database(&config).await?;
    tasks::search_management_migration::migrate_search_management_dates(&db).await?;
    config::runtime::migrate_options(&db, &config).await?;
    config::runtime::apply_database_options(&db, &mut config).await;

    // Create application state
    let state = app::create_state(db, config.clone());

    // 重建执行器只存在于当前进程内；重启后旧任务不能续跑，必须先收敛状态。
    if let Err(error) = tasks::search_maintenance::recover_interrupted_rebuilds(&state).await {
        return Err(format!("恢复 Meilisearch 重建任务状态失败: {error:?}").into());
    }

    // Start background tasks
    info!("启动后台任务...");

    // 仅启动维护计划检查器；索引重建必须由管理员或已启用的计划触发。
    tasks::search_maintenance::start_search_maintenance_scheduler(state.clone());
    tasks::meilisearch_incremental::start_incremental_sync_worker(state.clone());
    {
        let index_state = state.clone();
        tokio::spawn(async move {
            loop {
                let initialization_result = async {
                    let cleaned_indexes =
                        tasks::search_maintenance::cleanup_orphaned_rebuild_indexes(&index_state)
                            .await?;
                    if cleaned_indexes > 0 {
                        tracing::info!(cleaned_indexes, "已清理历史 Meilisearch 重建临时索引");
                    }
                    tasks::search_maintenance::ensure_managed_indexes(&index_state).await
                }
                .await;
                match initialization_result {
                    Ok(()) => break,
                    Err(error) => {
                        tracing::warn!(
                            ?error,
                            "Meilisearch 初始化或历史临时索引清理失败，30 秒后重试"
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
                    }
                }
            }
        });
    }
    info!("Meilisearch 增量同步已启用，维护计划检查器已启动");

    // Start link health check task
    let link_check_interval = state.config.link_health_interval_hours;
    info!("正在预热友链健康检查缓存...");
    tasks::run_link_health_check(&state).await;
    tasks::start_link_health_task(state.clone());
    info!(
        "友链健康检查任务已启动（间隔: {}小时）",
        link_check_interval
    );

    // Start NetEase now playing polling task
    tasks::start_netease_now_playing_task(state.clone(), state.ncm_np_service.clone());
    info!("网易云播放状态轮询任务已启动");

    // Build router
    let app = create_app(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}

/// Create application router with all layers
fn create_app(state: app::SharedState) -> Router {
    app::create_router(state)
}

/// Graceful shutdown signal handler
async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(e) = signal::ctrl_c().await {
            tracing::error!("Failed to install Ctrl+C handler: {}", e);
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => tracing::error!("Failed to install signal handler: {}", e),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, shutting down...");
        },
        _ = terminate => {
            info!("Received terminate signal, shutting down...");
        },
    }
}
