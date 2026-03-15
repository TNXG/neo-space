//! Axum Backend for Neo-Space
//!
//! A modern web backend built with Axum framework.

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
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls ring CryptoProvider");

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
    let config = AppConfig::from_env()?;
    info!("Configuration loaded successfully");

    // Initialize database
    let db = database::init_database(&config).await?;

    // Create application state
    let state = app::create_state(db, config.clone());

    // Start background tasks
    info!("启动后台任务...");

    // Start MongoDB Change Stream monitoring
    tasks::start_change_stream_task(state.clone());
    info!("Change Stream 监听任务已启动（后台任务）");

    // Start link health check task
    let link_check_interval = std::env::var("LINK_HEALTH_CHECK_INTERVAL_HOURS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(6);
    tasks::start_link_health_task(state.clone());
    info!(
        "友链健康检查任务已启动（间隔: {}小时）",
        link_check_interval
    );

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
