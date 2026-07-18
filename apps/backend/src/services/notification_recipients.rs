//! 评论通知的收件人解析。
//!
//! 业务规则（与前端 §0 / 评论提醒系统一致）：
//!
//! 1. 新评论默认关联到「直接父级评论」，回复提醒精准投递给「直接父级评论作者」，
//!    而非根评论作者——因此收件人只看 `parent_author_email`，不看 root。
//! 2. 自回复去重：评论作者本人（按邮箱匹配，大小写不敏感）绝不收到提醒。
//! 3. 多身份合并去重：同一邮箱在本次操作中既是文章作者（admin）又是直接父级评论
//!    作者时，合并为一条「高优先级」通知，避免重复打扰。
//! 4. 顶层评论没有父级，仅通知 admin（且 admin 邮箱 != 评论作者邮箱时）。
//!
//! 收件人邮箱统一小写化后比较，避免 `A@x.com` 与 `a@x.com` 被当作两人。

use super::notification::CommentNotification;

/// 收件人角色——用于邮件文案与优先级判定。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum NotificationRole {
    /// 站点 / 文章作者（owner），始终在收件人候选中。
    Admin,
    /// 被回复的直接父级评论作者。
    ParentAuthor,
}

/// 单条通知的优先级——多身份合并时升级为 High。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotificationPriority {
    Normal,
    High,
}

/// 解析后的收件人。
#[derive(Debug, Clone)]
pub struct NotificationRecipient {
    /// 收件邮箱（已小写化）。
    pub email: String,
    /// 该邮箱在本次操作中承担的全部角色——用于文案与优先级判定。
    pub roles: Vec<NotificationRole>,
    pub priority: NotificationPriority,
}

impl NotificationRecipient {
    pub fn is_high_priority(&self) -> bool {
        self.priority == NotificationPriority::High
    }

    /// 是否同时承担多个角色（用于高优先级合并）。
    fn has_multiple_roles(&self) -> bool {
        self.roles.len() > 1
    }
}

/// 构建本次评论操作的收件人列表。
///
/// `admin_email` 为站点 / 文章作者邮箱（由 `NotificationService::get_admin_config` 解析）。
/// 返回值已按邮箱去重、过滤自回复、并标注优先级，可直接逐条发送。
pub fn build_recipients(notification: &CommentNotification, admin_email: &str) -> Vec<NotificationRecipient> {
    let author_email = normalize_email(&notification.email);
    let admin_email_norm = normalize_email(admin_email);

    // 角色候选：邮箱 -> 角色集合
    let mut roles_by_email: std::collections::HashMap<String, Vec<NotificationRole>> =
        std::collections::HashMap::new();

    // 1. admin 始终是候选收件人（文章作者总会收到新评论提醒）
    push_role(&mut roles_by_email, admin_email_norm.clone(), NotificationRole::Admin);

    // 2. 回复场景：把直接父级评论作者加入候选——只看直接父级，不看 root
    if notification.is_reply {
        if let Some(parent_email) = notification.parent_author_email.as_deref().map(normalize_email) {
            if !parent_email.is_empty() {
                push_role(&mut roles_by_email, parent_email, NotificationRole::ParentAuthor);
            }
        }
    }

    // 3. 自回复去重：评论作者本人绝不收提醒
    roles_by_email.remove(&author_email);

    // 4. 合并角色 -> 优先级，并按稳定顺序输出（admin 在前，便于日志可读）
    let mut recipients: Vec<NotificationRecipient> = roles_by_email
        .into_iter()
        .map(|(email, mut roles)| {
            // admin 优先排在 roles 首位，便于模板按角色优先级渲染
            roles.sort_by_key(|r| match r {
                NotificationRole::Admin => 0,
                NotificationRole::ParentAuthor => 1,
            });
            let priority = if roles.len() > 1 {
                NotificationPriority::High
            } else {
                NotificationPriority::Normal
            };
            NotificationRecipient { email, roles, priority }
        })
        .collect();

    // 稳定排序：admin-only 收件人优先，高优先级次之
    recipients.sort_by_key(|r| {
        let is_admin_only = r.roles == vec![NotificationRole::Admin];
        (!is_admin_only, !r.has_multiple_roles())
    });

    recipients
}

fn push_role(
    roles_by_email: &mut std::collections::HashMap<String, Vec<NotificationRole>>,
    email: String,
    role: NotificationRole,
) {
    if email.is_empty() {
        return;
    }
    let roles = roles_by_email.entry(email).or_default();
    if !roles.contains(&role) {
        roles.push(role);
    }
}

/// 邮箱归一化：trim + 小写，避免大小写差异导致去重失败。
fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn notification(author_email: &str, parent_email: Option<&str>) -> CommentNotification {
        CommentNotification {
            comment_id: "64b7f1c2a1b2c3d4e5f6a7b8".to_string(),
            author: "tester".to_string(),
            text: "hi".to_string(),
            email: author_email.to_string(),
            ref_type: "posts".to_string(),
            ref_id: "ref".to_string(),
            ref_title: None,
            created: bson::DateTime::now(),
            is_reply: parent_email.is_some(),
            parent_comment_id: Some("parent-id".to_string()),
            parent_author: Some("parent".to_string()),
            parent_author_email: parent_email.map(|e| e.to_string()),
            ua: None,
            location: None,
        }
    }

    #[test]
    fn top_level_notifies_admin_only() {
        let n = notification("user@x.com", None);
        let rs = build_recipients(&n, "admin@x.com");
        assert_eq!(rs.len(), 1);
        assert_eq!(rs[0].email, "admin@x.com");
        assert_eq!(rs[0].roles, vec![NotificationRole::Admin]);
        assert!(!rs[0].is_high_priority());
    }

    #[test]
    fn self_top_level_skips_admin() {
        // admin 给自己文章评论——不提醒自己
        let n = notification("admin@x.com", None);
        let rs = build_recipients(&n, "admin@x.com");
        assert!(rs.is_empty(), "self-comment must not notify author");
    }

    #[test]
    fn reply_notifies_parent_and_admin() {
        let n = notification("user@x.com", Some("parent@x.com"));
        let rs = build_recipients(&n, "admin@x.com");
        let emails: Vec<_> = rs.iter().map(|r| r.email.clone()).collect();
        assert!(emails.contains(&"admin@x.com".to_string()));
        assert!(emails.contains(&"parent@x.com".to_string()));
        assert!(rs.iter().all(|r| !r.is_high_priority()));
    }

    #[test]
    fn reply_to_self_skips_parent() {
        // 用户回复自己的评论——不提醒自己
        let n = notification("user@x.com", Some("user@x.com"));
        let rs = build_recipients(&n, "admin@x.com");
        assert_eq!(rs.len(), 1);
        assert_eq!(rs[0].email, "admin@x.com");
    }

    #[test]
    fn merged_roles_get_high_priority() {
        // 父级评论作者 == 文章作者 -> 合并为一条高优先级
        let n = notification("user@x.com", Some("admin@x.com"));
        let rs = build_recipients(&n, "admin@x.com");
        assert_eq!(rs.len(), 1, "must merge admin + parent author");
        assert_eq!(rs[0].email, "admin@x.com");
        assert!(rs[0].is_high_priority());
        assert!(rs[0].roles.contains(&NotificationRole::Admin));
        assert!(rs[0].roles.contains(&NotificationRole::ParentAuthor));
    }

    #[test]
    fn email_case_insensitive_dedup() {
        let n = notification("user@x.com", Some("Admin@X.com"));
        let rs = build_recipients(&n, "ADMIN@X.com");
        assert_eq!(rs.len(), 1);
        assert!(rs[0].is_high_priority());
    }
}
