//! Comment service - business logic for comments
//!
//! Split into sub-modules:
//!
//! - `tree` - Comment tree building and reader mappings
//!
//! 旧版 `keys` 方案已弃用，楼层 key 改为在读取时动态计算。

mod tree;

use crate::auth::extractors::OptionalAuth;
use crate::error::{AppError, AppResult};
use crate::models::{Comment, CommentState, account::Account, user::Reader};
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

    pub fn normalize_ref_type(ref_type: &str) -> String {
        match ref_type {
            "post" | "posts" => "posts".to_string(),
            "note" | "notes" => "notes".to_string(),
            "page" | "pages" => "pages".to_string(),
            other => other.to_string(),
        }
    }

    fn ref_type_variants(ref_type: &str) -> Vec<String> {
        match Self::normalize_ref_type(ref_type).as_str() {
            "posts" => vec!["posts".to_string(), "post".to_string()],
            "notes" => vec!["notes".to_string(), "note".to_string()],
            "pages" => vec!["pages".to_string(), "page".to_string()],
            other => vec![other.to_string()],
        }
    }

    pub fn build_ref_filter(ref_id: &str, ref_type: &str) -> bson::Document {
        let ref_type_variants = Self::ref_type_variants(ref_type);
        let mut ref_candidates = vec![doc! { "ref": ref_id }, doc! { "refId": ref_id }];

        if let Ok(object_id) = ObjectId::parse_str(ref_id) {
            ref_candidates.push(doc! { "ref": object_id });
        }

        doc! {
            "$and": [
                {
                    "$or": ref_candidates
                },
                {
                    "refType": { "$in": ref_type_variants }
                },
                {
                    "isDeleted": { "$ne": true }
                }
            ]
        }
    }

    fn approved_visibility_clause() -> bson::Document {
        doc! {
            "$or": [
                {
                    "state": { "$in": [CommentState::UNREAD, CommentState::READ] },
                    "isWhispers": false,
                },
                {
                    "status": "approved",
                    "isWhispers": false,
                }
            ]
        }
    }

    fn author_match_clause(email: &str) -> bson::Document {
        doc! {
            "$or": [
                { "mail": email },
                { "email": email }
            ]
        }
    }

    /// Build comment visibility filter based on user role
    pub async fn build_visibility_filter(
        &self,
        ref_id: &str,
        ref_type: &str,
        auth: &OptionalAuth,
    ) -> bson::Document {
        let base_filter = Self::build_ref_filter(ref_id, ref_type);

        if auth.is_owner {
            tracing::debug!("Admin mode: showing all comments");
            return base_filter;
        }

        if let Some(user_id) = auth.user_id {
            let collection = self.db.collection::<crate::models::Reader>("readers");

            if let Ok(Some(reader)) = collection.find_one(doc! { "_id": user_id }).await {
                tracing::debug!(
                    "User mode: showing normal comments + user {}'s all comments (including pending)",
                    reader.email
                );

                return doc! {
                    "$and": [
                        base_filter.clone(),
                        {
                            "$or": [
                                Self::approved_visibility_clause(),
                                doc! {
                                    "$and": [
                                        Self::author_match_clause(&reader.email),
                                        {
                                            "$or": [
                                                { "state": { "$in": [CommentState::UNREAD, CommentState::READ, CommentState::PENDING] } },
                                                { "status": { "$in": ["approved", "pending"] } }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ],
                };
            }

            tracing::debug!("User not found, showing only normal public comments");
            return doc! {
                "$and": [
                    base_filter.clone(),
                    Self::approved_visibility_clause()
                ]
            };
        }

        tracing::debug!("Anonymous mode: showing only normal public comments");
        doc! {
            "$and": [
                base_filter,
                Self::approved_visibility_clause()
            ]
        }
    }

    /// 更新旧评论结构下的父评论统计信息。
    pub async fn register_reply(
        &self,
        parent_id: ObjectId,
        root_comment_id: Option<ObjectId>,
        reply_created_at: bson::DateTime,
    ) -> Result<(), String> {
        let collection = self.db.collection::<Comment>("comments");

        collection
            .update_one(
                doc! { "_id": parent_id },
                doc! {
                    "$inc": { "replyCount": 1 },
                    "$set": { "latestReplyAt": reply_created_at }
                },
            )
            .await
            .map_err(|e| e.to_string())?;

        if let Some(root_id) = root_comment_id
            && root_id != parent_id
        {
            collection
                .update_one(
                    doc! { "_id": root_id },
                    doc! {
                        "$set": { "latestReplyAt": reply_created_at }
                    },
                )
                .await
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    /// 收集某条评论及其所有后代评论，用于级联删除。
    pub async fn collect_comment_subtree_ids(
        &self,
        root_id: ObjectId,
    ) -> Result<Vec<ObjectId>, String> {
        let collection = self.db.collection::<Comment>("comments");
        let mut all_ids = vec![root_id];
        let mut frontier = vec![root_id];

        while !frontier.is_empty() {
            let mut cursor = collection
                .find(doc! {
                    "parentCommentId": { "$in": &frontier },
                    "isDeleted": { "$ne": true }
                })
                .await
                .map_err(|e| e.to_string())?;

            let mut next_frontier = Vec::new();
            while let Some(comment) = cursor.try_next().await.map_err(|e| e.to_string())? {
                if let Some(id) = comment.id {
                    next_frontier.push(id);
                }
            }

            if next_frontier.is_empty() {
                break;
            }

            all_ids.extend(next_frontier.iter().copied());
            frontier = next_frontier;
        }

        Ok(all_ids)
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
