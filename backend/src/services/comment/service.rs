//! 评论服务 - 封装评论相关的业务逻辑

use md5;
use mongodb::bson::{doc, oid::ObjectId, DateTime};
use mongodb::{Collection, Database};
use std::collections::HashMap;

use crate::guards::OptionalAuthGuard;
use crate::models::{Comment, CommentTree};
use crate::services::ReaderRepository;

/// 评论服务
pub struct CommentService {
    collection: Collection<Comment>,
    reader_repo: ReaderRepository,
}

impl CommentService {
    /// 创建新的评论服务实例
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection::<Comment>("comments"),
            reader_repo: ReaderRepository::new(db),
        }
    }

    /// 根据邮箱生成 Gravatar/Cravatar 头像 URL
    pub fn generate_avatar_url(email: &str) -> String {
        let trimmed = email.trim().to_lowercase();
        let hash = format!("{:x}", md5::compute(trimmed.as_bytes()));
        format!("https://cravatar.cn/avatar/{}", hash)
    }

    /// 创建空评论对象（用于错误响应）
    pub fn empty_comment() -> Comment {
        Comment {
            id: None,
            r#ref: ObjectId::new(),
            ref_type: String::new(),
            author: String::new(),
            mail: String::new(),
            text: String::new(),
            state: 0,
            children: None,
            comments_index: 0,
            key: String::new(),
            ip: None,
            agent: None,
            pin: false,
            is_whispers: false,
            source: None,
            avatar: None,
            created: DateTime::now(),
            location: None,
            url: None,
            parent: None,
            ua: None,
        }
    }

    /// 构建评论查询过滤器，根据用户权限过滤可见评论
    pub async fn build_visibility_filter(
        &self,
        ref_oid: ObjectId,
        ref_type: &str,
        auth: &OptionalAuthGuard,
    ) -> Result<mongodb::bson::Document, String> {
        log::debug!(
            "构建评论过滤器: user_id={:?}, is_owner={}",
            auth.user_id,
            auth.is_owner
        );

        // 根据用户身份构建过滤器
        if auth.is_owner {
            // 管理员：可以看到所有评论（包括待审核、垃圾评论等）
            log::debug!("管理员模式：显示所有评论");
            return Ok(doc! {
                "ref": ref_oid,
                "refType": ref_type,
            });
        }

        if let Some(user_id) = auth.user_id {
            // 普通登录用户：可以看到正常评论 + 自己的所有评论（包括待审核的）
            let user_reader = self
                .reader_repo
                .find_by_id(user_id)
                .await
                .map_err(|e| e.to_string())?;

            if let Some(reader) = user_reader {
                log::debug!(
                    "普通用户模式：显示正常评论 + 用户 {} 的所有评论（包括待审核）",
                    reader.email
                );
                
                // 构建复合过滤器：
                // 1. 正常状态的公开评论（state = 0 或 1，且非私密）
                // 2. 自己的所有评论（包括待审核 state = 3，但排除垃圾 state = 2）
                let filter = doc! {
                    "ref": ref_oid,
                    "refType": ref_type,
                    "$or": [
                        // 正常状态的公开评论
                        doc! {
                            "state": { "$in": [0, 1] },
                            "isWhispers": false,
                        },
                        // 正常状态的自己的私密评论
                        doc! {
                            "state": { "$in": [0, 1] },
                            "mail": &reader.email,
                        },
                        // 自己的待审核评论（state = 3）
                        doc! {
                            "state": 3,
                            "mail": &reader.email,
                        },
                    ],
                };
                
                return Ok(filter);
            } else {
                // 用户不存在，只显示正常状态的公开评论
                log::debug!("用户不存在，只显示正常状态的公开评论");
                return Ok(doc! {
                    "ref": ref_oid,
                    "refType": ref_type,
                    "state": { "$in": [0, 1] },
                    "isWhispers": false,
                });
            }
        }

        // 匿名用户：只能看到正常状态的公开评论
        log::debug!("匿名用户模式：只显示正常状态的公开评论");
        Ok(doc! {
            "ref": ref_oid,
            "refType": ref_type,
            "state": { "$in": [0, 1] },
            "isWhispers": false,
        })
    }

    /// 批量查询 Reader 信息，构建邮箱到头像和站长身份的映射
    pub async fn build_reader_mappings(
        &self,
        emails: Vec<String>,
    ) -> Result<(HashMap<String, String>, HashMap<String, bool>), String> {
        let mut email_to_avatar = HashMap::new();
        let mut email_to_is_owner = HashMap::new();

        for email in emails {
            // 通过邮箱查找 Reader（假设邮箱是唯一的）
            if let Ok(readers) = self.reader_repo.get_all().await {
                for reader in readers {
                    if reader.email == email {
                        if !reader.image.is_empty() {
                            email_to_avatar.insert(email.clone(), reader.image.clone());
                        }
                        email_to_is_owner.insert(email.clone(), reader.is_owner);
                        break;
                    }
                }
            }
        }

        Ok((email_to_avatar, email_to_is_owner))
    }

    /// 构建评论树形结构
    pub fn build_comment_tree(
        comments: &[Comment],
        email_to_avatar: &HashMap<String, String>,
        email_to_is_owner: &HashMap<String, bool>,
    ) -> Vec<CommentTree> {
        // 创建 ID 到评论的映射
        let mut comment_map: HashMap<String, CommentTree> = HashMap::new();
        let mut root_ids: Vec<String> = Vec::new();

        // 第一遍：创建所有评论节点，并记录根评论 ID
        for comment in comments {
            let id_str = match comment.id.as_ref() {
                Some(id) => id.to_hex(),
                None => {
                    log::error!("comment missing id: {:?}", comment);
                    continue;
                } // 跳过没有 ID 的评论
            };

            // 优先使用 Reader 的最新头像，否则使用评论保存的头像，最后根据邮箱生成
            let avatar_url = email_to_avatar
                .get(&comment.mail)
                .cloned()
                .or_else(|| comment.avatar.clone())
                .unwrap_or_else(|| Self::generate_avatar_url(&comment.mail));

            // 判断是否为站长
            let is_admin = email_to_is_owner
                .get(&comment.mail)
                .copied()
                .filter(|&is_owner| is_owner);

            let tree_node = CommentTree {
                id: id_str.clone(),
                r#ref: comment.r#ref.to_hex(),
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
                parent: comment.parent.as_ref().map(|p| p.to_hex()),
                ua: comment.ua.clone(),
            };

            // 记录根评论 ID
            if comment.parent.is_none() {
                root_ids.push(id_str.clone());
            }

            comment_map.insert(id_str, tree_node);
        }

        // 递归构建子树
        fn build_children(
            parent_id: &str,
            comment_map: &HashMap<String, CommentTree>,
            comments: &[Comment],
        ) -> Vec<CommentTree> {
            let mut children = Vec::new();

            for comment in comments {
                if let Some(parent_oid) = &comment.parent {
                    if parent_oid.to_hex() == parent_id {
                        let child_id = match comment.id.as_ref() {
                            Some(id) => id.to_hex(),
                            None => {
                                log::error!("comment missing id: {:?}", comment);
                                continue;
                            }
                        };

                        if let Some(mut child_node) = comment_map.get(&child_id).cloned() {
                            // 递归构建子评论的子评论
                            child_node.children = build_children(&child_id, comment_map, comments);
                            children.push(child_node);
                        }
                    }
                }
            }

            // 按创建时间排序
            children.sort_by(|a, b| a.created.cmp(&b.created));
            children
        }

        // 构建根评论及其子树
        let mut root_comments = Vec::new();
        for root_id in root_ids {
            if let Some(mut root_node) = comment_map.get(&root_id).cloned() {
                root_node.children = build_children(&root_id, &comment_map, comments);
                root_comments.push(root_node);
            }
        }

        // 按创建时间排序
        root_comments.sort_by(|a, b| a.created.cmp(&b.created));

        root_comments
    }

    /// 生成评论的 key（层级标识）
    pub async fn generate_comment_key(
        &self,
        ref_oid: ObjectId,
        ref_type: &str,
        parent_oid: Option<ObjectId>,
    ) -> Result<String, String> {
        let key = if let Some(parent_id) = parent_oid {
            // 回复评论：获取父评论的 key，然后追加子评论序号
            let parent_comment = self
                .collection
                .find_one(doc! { "_id": parent_id })
                .await
                .map_err(|e| e.to_string())?;

            if let Some(parent) = parent_comment {
                // 统计该父评论下已有的直接子评论数量
                let sibling_count = self
                    .collection
                    .count_documents(doc! { "parent": parent_id })
                    .await
                    .map_err(|e| e.to_string())?;
                // 父评论 key 如 "#1" 或 "#1#2"，子评论 key 为 "#1#1" 或 "#1#2#1"
                format!("{}#{}", parent.key, sibling_count + 1)
            } else {
                // 父评论不存在，降级为根评论处理
                let root_count = self
                    .collection
                    .count_documents(doc! { "ref": ref_oid, "refType": ref_type, "parent": null })
                    .await
                    .map_err(|e| e.to_string())?;
                format!("#{}", root_count + 1)
            }
        } else {
            // 根评论：统计该文章下的根评论数量
            let root_count = self
                .collection
                .count_documents(doc! { "ref": ref_oid, "refType": ref_type, "parent": null })
                .await
                .map_err(|e| e.to_string())?;
            format!("#{}", root_count + 1)
        };

        Ok(key)
    }

    /// 获取评论索引（所有评论的总数）
    pub async fn get_comment_index(
        &self,
        ref_oid: ObjectId,
        ref_type: &str,
    ) -> Result<i32, String> {
        let count = self
            .collection
            .count_documents(doc! { "ref": ref_oid, "refType": ref_type })
            .await
            .map_err(|e| e.to_string())?;

        Ok((count + 1) as i32)
    }

    /// 更新父评论的 children 字段
    pub async fn update_parent_children(
        &self,
        parent_id: ObjectId,
        child_id: ObjectId,
    ) -> Result<(), String> {
        self.collection
            .update_one(
                doc! { "_id": parent_id },
                doc! { "$push": { "children": child_id } },
            )
            .await
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
