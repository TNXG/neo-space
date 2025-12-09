use mongodb::{Client, Database};
use rocket::figment::{Figment, providers::{Format, Toml}};

/// MongoDB configuration structure
#[derive(serde::Deserialize, Debug)]
pub struct MongoConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
}

impl Default for MongoConfig {
    fn default() -> Self {
        Self {
            host: "localhost".to_string(),
            port: 27017,
            database: "mx-space".to_string(),
        }
    }
}

/// Initialize MongoDB connection
/// MongoDB configuration should be in Rocket.toml under [default.mongodb]
pub async fn init_db() -> Result<Database, mongodb::error::Error> {
    // Read configuration from Rocket.toml
    let figment = Figment::from(rocket::Config::default())
        .merge(Toml::file("Rocket.toml").nested());
    
    let config: MongoConfig = figment
        .extract_inner("mongodb")
        .unwrap_or_else(|e| {
            eprintln!("Warning: MongoDB config not found in Rocket.toml: {:?}", e);
            eprintln!("Using default configuration");
            MongoConfig::default()
        });
    
    // Build MongoDB URI
    let uri = format!("mongodb://{}:{}", config.host, config.port);
    
    println!("Connecting to MongoDB at {} (database: {})...", uri, config.database);
    
    let client = Client::with_uri_str(&uri).await?;
    
    // Verify connection
    client
        .database(&config.database)
        .run_command(mongodb::bson::doc! { "ping": 1 })
        .await?;
    
    println!("✓ Successfully connected to MongoDB database: {}", config.database);
    
    Ok(client.database(&config.database))
}
