//! Database service - MongoDB connection and operations

use mongodb::{bson::doc, Client, Database};

/// 初始化 MongoDB 连接
/// MongoDB 配置从环境变量 MONGODB_URI 读取
pub async fn init_db() -> Result<Database, mongodb::error::Error> {
    // 从环境变量读取 MongoDB URI
    let mongodb_uri = std::env::var("MONGODB_URI")
        .unwrap_or_else(|_| {
            eprintln!("警告: 环境变量中未找到 MONGODB_URI");
            eprintln!("使用默认配置: mongodb://localhost:27017/mx-space");
            "mongodb://localhost:27017/mx-space".to_string()
        });

    println!("正在连接 MongoDB: {}...", mongodb_uri);

    let client = Client::with_uri_str(&mongodb_uri).await?;

    // 从 URI 中提取数据库名称
    let database_name = mongodb_uri
        .split('/')
        .last()
        .and_then(|s| s.split('?').next())
        .unwrap_or("mx-space");

    let database = client.database(database_name);

    // 验证连接
    database
        .run_command(doc! { "ping": 1 })
        .await?;

    println!("✓ 成功连接到 MongoDB 数据库: {}", database_name);

    Ok(database)
}

