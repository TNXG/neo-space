//! Comment tree building and reader mappings

use crate::models::account::Account;
use crate::models::reader::Reader;
use crate::models::{Comment, CommentTree};
use bson::{Document, doc};
use futures::stream::TryStreamExt;
use std::collections::{HashMap, HashSet};

use super::CommentService;

impl CommentService {
    /// Build Reader mappings from emails to avatars and admin status
    pub async fn build_reader_mappings(
        &self,
        emails: Vec<String>,
    ) -> (
        HashMap<String, String>,
        HashMap<String, bool>,
        HashMap<String, String>,
    ) {
        let mut email_to_avatar = HashMap::new();
        let mut email_to_is_owner = HashMap::new();
        let mut email_to_source = HashMap::new();

        if emails.is_empty() {
            return (email_to_avatar, email_to_is_owner, email_to_source);
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

        self.enrich_owner_mappings(
            &mut email_to_avatar,
            &mut email_to_is_owner,
            &mut email_to_source,
        )
        .await;

        (email_to_avatar, email_to_is_owner, email_to_source)
    }

    /// 站长身份需要兼容历史评论邮箱与旧数据中的 source 空值。
    ///
    /// 这里会读取 owner_profiles、当前绑定账号以及历史 owner 评论，
    /// 把可确认属于站长的邮箱都回填成站长身份与 OAuth 来源。
    async fn enrich_owner_mappings(
        &self,
        email_to_avatar: &mut HashMap<String, String>,
        email_to_is_owner: &mut HashMap<String, bool>,
        email_to_source: &mut HashMap<String, String>,
    ) {
        let owner_profiles = self.db.collection::<Document>("owner_profiles");
        let readers = self.db.collection::<Reader>("readers");
        let accounts = self.db.collection::<Account>("accounts");
        let comments = self.db.collection::<Comment>("comments");

        let mut owner_cursor = match owner_profiles.find(doc! {}).await {
            Ok(cursor) => cursor,
            Err(error) => {
                tracing::warn!(
                    "Failed to fetch owner_profiles for owner mappings: {}",
                    error
                );
                return;
            }
        };

        while let Ok(Some(profile)) = owner_cursor.try_next().await {
            let Ok(reader_id) = profile.get_object_id("readerId") else {
                continue;
            };

            let owner_reader = match readers.find_one(doc! { "_id": reader_id }).await {
                Ok(reader) => reader,
                Err(error) => {
                    tracing::warn!("Failed to fetch owner reader {}: {}", reader_id, error);
                    continue;
                }
            };

            let Some(owner_reader) = owner_reader else {
                continue;
            };

            let mut owner_emails = HashSet::from([owner_reader.email.clone()]);
            let mut owner_names = HashSet::from([owner_reader.name.clone()]);

            if let Ok(mail) = profile.get_str("mail")
                && !mail.trim().is_empty()
            {
                owner_emails.insert(mail.trim().to_string());
            }

            if let Ok(social_ids) = profile.get_document("socialIds")
                && let Ok(mail) = social_ids.get_str("mail")
                && !mail.trim().is_empty()
            {
                owner_emails.insert(mail.trim().to_string());
            }

            let mut has_github = false;
            let mut has_qq = false;
            let mut account_cursor = match accounts.find(doc! { "userId": reader_id }).await {
                Ok(cursor) => cursor,
                Err(error) => {
                    tracing::warn!("Failed to fetch owner accounts {}: {}", reader_id, error);
                    continue;
                }
            };

            while let Ok(Some(account)) = account_cursor.try_next().await {
                match account.provider.as_str() {
                    "github" => has_github = true,
                    "qq" => has_qq = true,
                    _ => {}
                }

                if let Some(oauth_email) = account.oauth_email.as_deref()
                    && !oauth_email.trim().is_empty()
                {
                    owner_emails.insert(oauth_email.trim().to_string());
                }

                if let Some(oauth_name) = account.oauth_name.as_deref()
                    && !oauth_name.trim().is_empty()
                {
                    owner_names.insert(oauth_name.trim().to_string());
                }
            }

            let owner_source = match (has_github, has_qq) {
                (true, false) => Some("from_oauth_github".to_string()),
                (false, true) => Some("from_oauth_qq".to_string()),
                (true, true) => Some("from_oauth_both".to_string()),
                (false, false) => None,
            };

            let owner_avatar = (!owner_reader.image.is_empty()).then(|| owner_reader.image.clone());

            let historical_filter = doc! {
                "$or": [
                    { "mail": { "$in": owner_emails.iter().cloned().collect::<Vec<_>>() } },
                    { "email": { "$in": owner_emails.iter().cloned().collect::<Vec<_>>() } },
                    { "author": { "$in": owner_names.iter().cloned().collect::<Vec<_>>() } }
                ]
            };

            let mut historical_cursor = match comments.find(historical_filter).await {
                Ok(cursor) => cursor,
                Err(error) => {
                    tracing::warn!("Failed to fetch historical owner comments: {}", error);
                    continue;
                }
            };

            while let Ok(Some(comment)) = historical_cursor.try_next().await {
                let email = comment.mail.trim();
                if email.is_empty() {
                    continue;
                }

                owner_emails.insert(email.to_string());
            }

            for email in owner_emails {
                email_to_is_owner.insert(email.clone(), true);

                if let Some(source) = &owner_source {
                    email_to_source.insert(email.clone(), source.clone());
                }

                if let Some(avatar) = &owner_avatar {
                    email_to_avatar.insert(email, avatar.clone());
                }
            }
        }
    }

    /// Build comment tree structure - O(n) with parent index
    pub fn build_comment_tree(
        &self,
        comments: &[Comment],
        email_to_avatar: &HashMap<String, String>,
        email_to_is_owner: &HashMap<String, bool>,
        email_to_source: &HashMap<String, String>,
    ) -> Vec<CommentTree> {
        let mut ordered_comments: Vec<&Comment> = comments
            .iter()
            .filter(|comment| comment.id.is_some() && !comment.is_deleted)
            .collect();

        ordered_comments.sort_by(|left, right| {
            left.created
                .cmp(&right.created)
                .then_with(|| left.id.cmp(&right.id))
        });

        let mut comment_map: HashMap<String, CommentTree> = HashMap::new();
        let mut children_index: HashMap<String, Vec<String>> = HashMap::new();
        let mut root_ids: Vec<String> = Vec::new();
        let mut parent_index: HashMap<String, Option<String>> = HashMap::new();
        let mut ordered_ids: Vec<String> = Vec::with_capacity(ordered_comments.len());

        for (index, comment) in ordered_comments.iter().enumerate() {
            let Some(id) = comment.id else {
                tracing::error!("comment missing id: {:?}", comment);
                continue;
            };
            let id_str = id.to_hex();
            let parent_id = comment.parent.map(|parent| parent.to_hex());

            let avatar_url = email_to_avatar
                .get(&comment.mail)
                .cloned()
                .or_else(|| comment.avatar.clone())
                .unwrap_or_else(|| Self::generate_avatar_url(&comment.mail));

            let is_admin = email_to_is_owner
                .get(&comment.mail)
                .copied()
                .filter(|&is_owner| is_owner);

            let resolved_source = comment
                .source
                .clone()
                .filter(|value| !value.trim().is_empty())
                .or_else(|| email_to_source.get(&comment.mail).cloned());

            let tree_node = CommentTree {
                id: id_str.clone(),
                r#ref: comment.reference_string(),
                ref_type: CommentService::normalize_ref_type(&comment.ref_type),
                author: comment.author.clone(),
                text: comment.text.clone(),
                state: comment.effective_state(),
                children: vec![],
                comments_index: (index + 1) as i32,
                key: String::new(),
                pin: comment.pin,
                is_whispers: comment.is_whispers,
                is_admin,
                source: resolved_source,
                avatar: Some(avatar_url),
                created: comment.created.to_chrono().to_rfc3339(),
                location: comment.location.clone(),
                url: comment.url.clone(),
                parent: parent_id.clone(),
                ua: comment.ua.clone(),
            };

            ordered_ids.push(id_str.clone());
            parent_index.insert(id_str.clone(), parent_id);
            comment_map.insert(id_str, tree_node);
        }

        let known_ids: HashSet<String> = ordered_ids.iter().cloned().collect();

        for id in &ordered_ids {
            match parent_index.get(id).cloned().flatten() {
                Some(parent_id) if known_ids.contains(&parent_id) => {
                    children_index
                        .entry(parent_id)
                        .or_default()
                        .push(id.clone());
                }
                _ => root_ids.push(id.clone()),
            }
        }

        let mut stack: Vec<(String, String)> = Vec::with_capacity(ordered_ids.len());
        for (index, root_id) in root_ids.iter().enumerate().rev() {
            stack.push((root_id.clone(), format!("#{}", index + 1)));
        }

        while let Some((node_id, key)) = stack.pop() {
            if let Some(node) = comment_map.get_mut(&node_id) {
                node.key = key.clone();
            }

            if let Some(children) = children_index.get(&node_id) {
                for (index, child_id) in children.iter().enumerate().rev() {
                    stack.push((child_id.clone(), format!("{key}#{}", index + 1)));
                }
            }
        }

        fn build_subtree(
            node_id: &str,
            comment_map: &mut HashMap<String, CommentTree>,
            children_index: &HashMap<String, Vec<String>>,
        ) -> Option<CommentTree> {
            let mut node = comment_map.remove(node_id)?;

            if let Some(children) = children_index.get(node_id) {
                node.children = children
                    .iter()
                    .filter_map(|child_id| build_subtree(child_id, comment_map, children_index))
                    .collect();
            }

            Some(node)
        }

        root_ids
            .into_iter()
            .filter_map(|id| build_subtree(&id, &mut comment_map, &children_index))
            .collect()
    }
}
