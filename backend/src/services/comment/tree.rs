//! Comment tree building and reader mappings

use crate::models::{Comment, CommentTree};
use bson::Bson;
use std::collections::HashMap;

use super::CommentService;

/// Convert Bson ref to string representation
fn bson_ref_to_string(ref_bson: &Bson) -> String {
    match ref_bson {
        Bson::ObjectId(oid) => oid.to_hex(),
        Bson::String(s) => s.clone(),
        _ => {
            tracing::warn!("Unexpected Bson type for ref: {:?}", ref_bson);
            format!("{:?}", ref_bson)
        }
    }
}

impl CommentService {
    /// Build Reader mappings from emails to avatars and admin status
    pub async fn build_reader_mappings(
        &self,
        emails: Vec<String>,
    ) -> (HashMap<String, String>, HashMap<String, bool>) {
        let mut email_to_avatar = HashMap::new();
        let mut email_to_is_owner = HashMap::new();

        if emails.is_empty() {
            return (email_to_avatar, email_to_is_owner);
        }

        let unique_emails: Vec<String> = emails
            .into_iter()
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        let collection = self.db.collection::<crate::models::Reader>("readers");

        let filter = bson::doc! { "email": { "$in": &unique_emails } };

        match collection.find(filter).await {
            Ok(mut cursor) => {
                use futures::stream::TryStreamExt;
                while let Ok(Some(reader)) = cursor.try_next().await {
                    if !reader.image.is_empty() {
                        email_to_avatar.insert(reader.email.clone(), reader.image.clone());
                    }
                    email_to_is_owner.insert(reader.email.clone(), reader.is_owner);
                }
            }
            Err(e) => {
                tracing::error!("Failed to fetch readers for mapping: {}", e);
            }
        }

        (email_to_avatar, email_to_is_owner)
    }

    /// Build comment tree structure - O(n) with parent index
    pub fn build_comment_tree(
        &self,
        comments: &[Comment],
        email_to_avatar: &HashMap<String, String>,
        email_to_is_owner: &HashMap<String, bool>,
    ) -> Vec<CommentTree> {
        let mut comment_map: HashMap<String, CommentTree> = HashMap::new();
        let mut children_index: HashMap<String, Vec<String>> = HashMap::new();
        let mut root_ids: Vec<String> = Vec::new();

        for comment in comments {
            let id_str = match comment.id {
                Some(id) => id.to_hex(),
                None => {
                    tracing::error!("comment missing id: {:?}", comment);
                    continue;
                }
            };

            let avatar_url = email_to_avatar
                .get(&comment.mail)
                .cloned()
                .or_else(|| comment.avatar.clone())
                .unwrap_or_else(|| Self::generate_avatar_url(&comment.mail));

            let is_admin = email_to_is_owner
                .get(&comment.mail)
                .copied()
                .filter(|&is_owner| is_owner);

            let tree_node = CommentTree {
                id: id_str.clone(),
                r#ref: bson_ref_to_string(&comment.r#ref),
                ref_type: comment.ref_type.clone(),
                author: comment.author.clone(),
                text: comment.text.clone(),
                state: comment.state,
                children: vec![],
                comments_index: comment.comments_index,
                key: comment.key.clone(),
                pin: comment.pin,
                is_whispers: comment.is_whispers,
                is_admin,
                source: comment.source.clone(),
                avatar: Some(avatar_url),
                created: comment.created.to_chrono().to_rfc3339(),
                location: comment.location.clone(),
                url: comment.url.clone(),
                parent: comment.parent.map(|p| p.to_hex()),
                ua: comment.ua.clone(),
            };

            match &comment.parent {
                Some(parent_oid) => {
                    children_index
                        .entry(parent_oid.to_hex())
                        .or_default()
                        .push(id_str.clone());
                }
                None => {
                    root_ids.push(id_str.clone());
                }
            }

            comment_map.insert(id_str, tree_node);
        }

        // Build tree recursively using the index (O(n) total)
        fn attach_children(
            node_id: &str,
            comment_map: &mut HashMap<String, CommentTree>,
            children_index: &HashMap<String, Vec<String>>,
        ) {
            if let Some(child_ids) = children_index.get(node_id) {
                let mut child_ids = child_ids.clone();
                child_ids.sort_by(|a, b| {
                    let a_created = comment_map
                        .get(a)
                        .map(|n| n.created.clone())
                        .unwrap_or_default();
                    let b_created = comment_map
                        .get(b)
                        .map(|n| n.created.clone())
                        .unwrap_or_default();
                    a_created.cmp(&b_created)
                });

                for child_id in &child_ids {
                    attach_children(child_id, comment_map, children_index);
                }

                let children: Vec<CommentTree> = child_ids
                    .iter()
                    .filter_map(|id| comment_map.remove(id))
                    .collect();

                if let Some(node) = comment_map.get_mut(node_id) {
                    node.children = children;
                }
            }
        }

        // Sort root IDs by creation time
        root_ids.sort_by(|a, b| {
            let a_created = comment_map
                .get(a)
                .map(|n| n.created.clone())
                .unwrap_or_default();
            let b_created = comment_map
                .get(b)
                .map(|n| n.created.clone())
                .unwrap_or_default();
            a_created.cmp(&b_created)
        });

        let root_ids_clone = root_ids.clone();
        for root_id in &root_ids_clone {
            attach_children(root_id, &mut comment_map, &children_index);
        }

        root_ids
            .into_iter()
            .filter_map(|id| comment_map.remove(&id))
            .collect()
    }
}
