//! Comment key and index generation

use crate::models::Comment;
use bson::{doc, oid::ObjectId};

use super::CommentService;

impl CommentService {
    /// Generate comment key (hierarchical identifier like #1, #1#1, #1#2)
    pub async fn generate_comment_key(
        &self,
        ref_oid: ObjectId,
        ref_type: &str,
        parent_oid: Option<ObjectId>,
    ) -> Result<String, String> {
        let collection = self.db.collection::<Comment>("comments");

        let key = if let Some(parent_id) = parent_oid {
            // Reply: get parent's key, then append child index
            if let Ok(Some(parent)) = collection.find_one(doc! { "_id": parent_id }).await {
                let sibling_count = collection
                    .count_documents(doc! { "parent": parent_id })
                    .await
                    .map_err(|e| e.to_string())?;
                format!("{}#{}", parent.key, sibling_count + 1)
            } else {
                // Parent not found, fall back to root
                let root_count = collection
                    .count_documents(doc! {
                        "ref": ref_oid,
                        "refType": ref_type,
                        "parent": null
                    })
                    .await
                    .map_err(|e| e.to_string())?;
                format!("#{}", root_count + 1)
            }
        } else {
            // Root comment
            let root_count = collection
                .count_documents(doc! {
                    "ref": ref_oid,
                    "refType": ref_type,
                    "parent": null
                })
                .await
                .map_err(|e| e.to_string())?;
            format!("#{}", root_count + 1)
        };

        Ok(key)
    }

    /// Get comment index (total count of all comments for this ref)
    pub async fn get_comment_index(
        &self,
        ref_oid: ObjectId,
        ref_type: &str,
    ) -> Result<i32, String> {
        let collection = self.db.collection::<Comment>("comments");

        let count = collection
            .count_documents(doc! {
                "ref": ref_oid,
                "refType": ref_type
            })
            .await
            .map_err(|e| e.to_string())?;

        Ok((count + 1) as i32)
    }
}
