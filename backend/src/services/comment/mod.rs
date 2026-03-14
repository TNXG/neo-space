//! Comment service - business logic for comments
//!
//! Split into sub-modules:
//! - `tree` - Comment tree building and reader mappings
//! - `keys` - Key/index generation for hierarchical comments

mod keys;
mod tree;

use crate::auth::extractors::OptionalAuth;
use crate::error::{AppError, AppResult};
use crate::models::{Comment, account::Account, user::Reader};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use mongodb::Database;

/// Comment service
pub struct CommentService {
    db: Database,
}

impl CommentService {
    /// Create a new comment service
    pub fn new(db: Database) -> Self {
        Self { db }
    }

    /// Generate Gravatar/Cravatar avatar URL from email
    pub fn generate_avatar_url(email: &str) -> String {
        let trimmed = email.trim().to_lowercase();
        let hash = format!("{:x}", md5::compute(trimmed.as_bytes()));
        format!("https://cravatar.cn/avatar/{hash}")
    }

    /// Build comment visibility filter based on user role
    pub async fn build_visibility_filter(
        &self,
        ref_id: &str,
        ref_type: &str,
        auth: &OptionalAuth,
    ) -> bson::Document {
        // Try to parse as ObjectId, fall back to string if invalid
        let ref_bson = if let Ok(oid) = bson::oid::ObjectId::parse_str(ref_id) {
            bson::Bson::ObjectId(oid)
        } else {
            bson::Bson::String(ref_id.to_string())
        };

        if auth.is_owner {
            tracing::debug!("Admin mode: showing all comments");
            return doc! {
                "ref": ref_bson,
                "refType": ref_type,
            };
        }

        if let Some(user_id) = auth.user_id {
            let collection = self.db.collection::<crate::models::Reader>("readers");

            if let Ok(Some(reader)) = collection.find_one(doc! { "_id": user_id }).await {
                tracing::debug!(
                    "User mode: showing normal comments + user {}'s all comments (including pending)",
                    reader.email
                );

                return doc! {
                    "ref": ref_bson.clone(),
                    "refType": ref_type,
                    "$or": [
                        doc! {
                            "state": { "$in": [0, 1] },
                            "isWhispers": false,
                        },
                        doc! {
                            "state": { "$in": [0, 1] },
                            "mail": &reader.email,
                        },
                        doc! {
                            "state": 3,
                            "mail": &reader.email,
                        },
                    ],
                };
            }

            tracing::debug!("User not found, showing only normal public comments");
            return doc! {
                "ref": ref_bson.clone(),
                "refType": ref_type,
                "state": { "$in": [0, 1] },
                "isWhispers": false,
            };
        }

        tracing::debug!("Anonymous mode: showing only normal public comments");
        doc! {
            "ref": ref_bson,
            "refType": ref_type,
            "state": { "$in": [0, 1] },
            "isWhispers": false,
        }
    }

    /// Update parent comment's children field
    pub async fn update_parent_children(
        &self,
        parent_id: ObjectId,
        child_id: ObjectId,
    ) -> Result<(), String> {
        let collection = self.db.collection::<Comment>("comments");

        collection
            .update_one(
                doc! { "_id": parent_id },
                doc! { "$push": { "children": child_id } },
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Find or create anonymous Reader by name and email (matches Rocket's find_or_create_anonymous)
    pub async fn find_or_create_anonymous_reader(
        db: &Database,
        name: &str,
        email: &str,
    ) -> AppResult<ObjectId> {
        let collection = db.collection::<Reader>("readers");

        if let Some(existing) = collection
            .find_one(doc! { "email": email, "name": name })
            .await
            .map_err(|e| AppError::Database(format!("Failed to find reader: {}", e)))?
        {
            return Ok(existing.id);
        }

        let new_reader = Reader::new_anonymous(name.to_string(), email.to_string());
        let reader_id = new_reader.id;

        collection
            .insert_one(&new_reader)
            .await
            .map_err(|e| AppError::Database(format!("Failed to create anonymous reader: {}", e)))?;

        tracing::info!("Created anonymous reader: {} <{}>", name, email);
        Ok(reader_id)
    }

    /// Determine OAuth source from user's accounts (matches Rocket's determine_oauth_source)
    pub async fn determine_oauth_source(db: &Database, user_id: ObjectId) -> String {
        let collection = db.collection::<Account>("accounts");

        match collection.find(doc! { "userId": user_id }).await {
            Ok(mut cursor) => {
                let mut has_github = false;
                let mut has_qq = false;
                while let Ok(Some(account)) = cursor.try_next().await {
                    match account.provider.as_str() {
                        "github" => has_github = true,
                        "qq" => has_qq = true,
                        _ => {}
                    }
                }
                match (has_github, has_qq) {
                    (true, false) => "from_oauth_github".to_string(),
                    (false, true) => "from_oauth_qq".to_string(),
                    (true, true) => "from_oauth_both".to_string(),
                    (false, false) => "oauth".to_string(),
                }
            }
            Err(e) => {
                tracing::warn!("Failed to query OAuth accounts: {}", e);
                "oauth".to_string()
            }
        }
    }
}
