//! Database service - MongoDB connection and operations

use mongodb::{bson::doc, Client, Collection, Database};
use bson::oid::ObjectId;
use rocket::figment::{providers::{Format, Toml}, Figment};
use crate::config::MongoConfig;
use crate::models::{User, Reader};

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
        .run_command(doc! { "ping": 1 })
        .await?;

    println!("✓ Successfully connected to MongoDB database: {}", config.database);

    Ok(client.database(&config.database))
}

// ============================================================================
// User-related database operations
// ============================================================================

/// Get user profile (excluding sensitive data like password, apiToken, oauth2)
pub async fn get_user_profile(database: &Database) -> Result<User, mongodb::error::Error> {
    let collection: Collection<mongodb::bson::Document> = database.collection("users");

    // Project only non-sensitive fields (inclusion only)
    let projection = doc! {
        "_id": 1,
        "username": 1,
        "name": 1,
        "introduce": 1,
        "avatar": 1,
        "mail": 1,
        "url": 1,
        "created": 1,
        "lastLoginTime": 1,
        "socialIds": 1
    };

    let options = mongodb::options::FindOneOptions::builder()
        .projection(projection)
        .build();

    match collection.find_one(doc! {}).with_options(options).await? {
        Some(doc) => {
            let user: User = mongodb::bson::from_document(doc)?;
            Ok(user)
        }
        None => Err(mongodb::error::Error::custom("No user found")),
    }
}

/// Get all readers (excluding sensitive data)
pub async fn get_all_readers(database: &Database) -> Result<Vec<Reader>, mongodb::error::Error> {
    let collection: Collection<mongodb::bson::Document> = database.collection("readers");

    // Project only non-sensitive fields
    let projection = doc! {
        "_id": 1,
        "email": 1,
        "name": 1,
        "handle": 1,
        "image": 1,
        "isOwner": 1,
        "emailVerified": 1,
        "createdAt": 1,
        "updatedAt": 1
    };

    let options = mongodb::options::FindOptions::builder()
        .projection(projection)
        .sort(doc! { "createdAt": -1 })
        .build();

    let mut cursor = collection.find(doc! {}).with_options(options).await?;
    let mut readers = Vec::new();

    use futures::stream::TryStreamExt;
    while let Some(doc) = cursor.try_next().await? {
        let reader: Reader = mongodb::bson::from_document(doc)?;
        readers.push(reader);
    }

    Ok(readers)
}

/// Get reader by ID (excluding sensitive data)
pub async fn get_reader_by_id(
    database: &Database,
    id: &str,
) -> Result<Option<Reader>, mongodb::error::Error> {
    let collection: Collection<mongodb::bson::Document> = database.collection("readers");

    let object_id = match ObjectId::parse_str(id) {
        Ok(oid) => oid,
        Err(_) => return Ok(None),
    };

    // Project only non-sensitive fields
    let projection = doc! {
        "_id": 1,
        "email": 1,
        "name": 1,
        "handle": 1,
        "image": 1,
        "isOwner": 1,
        "emailVerified": 1,
        "createdAt": 1,
        "updatedAt": 1
    };

    let options = mongodb::options::FindOneOptions::builder()
        .projection(projection)
        .build();

    match collection.find_one(doc! { "_id": object_id }).with_options(options).await? {
        Some(doc) => {
            let reader: Reader = mongodb::bson::from_document(doc)?;
            Ok(Some(reader))
        }
        None => Ok(None),
    }
}
