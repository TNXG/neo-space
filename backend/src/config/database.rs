//! Database connection initialization

use mongodb::{
    Client, Database,
    bson::doc,
    options::{Acknowledgment, ClientOptions, ReadConcern, WriteConcern},
};

use super::AppConfig;

/// Initialize MongoDB connection from configuration
pub async fn init_database(config: &AppConfig) -> Result<Database, mongodb::error::Error> {
    tracing::info!("正在连接 MongoDB...");

    let mut client_options = ClientOptions::parse(&config.mongodb_uri).await?;

    // Configure timeout settings
    client_options.server_selection_timeout =
        Some(std::time::Duration::from_secs(config.mongodb_timeout_secs));
    client_options.connect_timeout =
        Some(std::time::Duration::from_secs(config.mongodb_timeout_secs));

    // Configure connection pool size
    client_options.max_pool_size = Some(config.mongodb_max_pool_size);

    // For single-node replica sets, force direct_connection
    if config.mongodb_uri.contains("directConnection=true") {
        client_options.direct_connection = Some(true);

        // Set write concern to w:1
        client_options.write_concern =
            Some(WriteConcern::builder().w(Acknowledgment::from(1)).build());

        // Set read concern to local
        client_options.read_concern = Some(ReadConcern::local());

        // Disable server monitoring for direct connection
        client_options.heartbeat_freq = Some(std::time::Duration::from_secs(60));
    }

    let client = Client::with_options(client_options)?;

    // Extract database name from URI
    let database_name = config
        .mongodb_uri
        .split('/')
        .next_back()
        .and_then(|s| s.split('?').next())
        .unwrap_or("mx-space");

    let database = client.database(database_name);

    // Verify connection
    database.run_command(doc! { "ping": 1 }).await?;

    tracing::info!("MongoDB 连接成功 - 数据库: {}", database_name);

    Ok(database)
}
