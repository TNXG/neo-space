//! 数据库初始化
//!
//! 负责数据库连接的初始化

use mongodb::{bson::doc, Client, Database};

/// 初始化 `MongoDB` 连接
///
/// 从环境变量 `MONGODB_URI` 读取配置
pub async fn init_database() -> Result<Database, mongodb::error::Error> {
    // 从环境变量读取 MongoDB URI
    let mongodb_uri = std::env::var("MONGODB_URI").unwrap_or_else(|_| {
        eprintln!("警告: 环境变量中未找到 MONGODB_URI");
        eprintln!("使用默认配置: mongodb://localhost:27017/mx-space");
        "mongodb://localhost:27017/mx-space".to_string()
    });

    println!("正在连接 MongoDB: {mongodb_uri}...");

    // 配置客户端选项，添加超时设置
    let mut client_options = mongodb::options::ClientOptions::parse(&mongodb_uri).await?;

    // 根据环境设置超时时间
    let timeout_secs = std::env::var("MONGODB_TIMEOUT_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(30); // 默认 30 秒（测试环境需要更长时间）

    client_options.server_selection_timeout = Some(std::time::Duration::from_secs(timeout_secs));
    client_options.connect_timeout = Some(std::time::Duration::from_secs(timeout_secs));

    // 限制连接池大小，避免测试时创建过多连接
    let max_pool_size = std::env::var("MONGODB_MAX_POOL_SIZE")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10); // 默认 10 个连接

    client_options.max_pool_size = Some(max_pool_size);

    // 对于单节点副本集，强制使用 direct_connection
    if mongodb_uri.contains("directConnection=true") {
        client_options.direct_connection = Some(true);

        // 设置写关注为 w:1（只需要主节点确认，不等待副本）
        use mongodb::options::WriteConcern;
        client_options.write_concern = Some(
            WriteConcern::builder()
                .w(mongodb::options::Acknowledgment::from(1))
                .build(),
        );

        // 设置读关注为 local（从本地读取，不等待副本确认）
        use mongodb::options::ReadConcern;
        client_options.read_concern = Some(ReadConcern::local());

        // 单节点副本集：禁用服务器监控，直接连接
        client_options.heartbeat_freq = Some(std::time::Duration::from_secs(60));
    }

    let client = Client::with_options(client_options)?;

    // 从 URI 中提取数据库名称
    let database_name = mongodb_uri
        .split('/')
        .next_back()
        .and_then(|s| s.split('?').next())
        .unwrap_or("mx-space");

    let database = client.database(database_name);

    // 验证连接
    database.run_command(doc! { "ping": 1 }).await?;

    println!("✓ 成功连接到 MongoDB 数据库: {database_name}");

    Ok(database)
}
