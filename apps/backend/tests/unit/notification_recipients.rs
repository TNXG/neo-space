#![allow(clippy::unwrap_used)]

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
        parent_author_email: parent_email.map(std::string::ToString::to_string),
        ua: None,
        location: None,
    }
}

#[test]
fn top_level_notifies_admin_only() {
    let n = notification("user@x.com", None);
    let rs = build_recipients(&n, "admin@x.com");
    assert_eq!(rs.len(), 1);
    assert_eq!(rs.first().unwrap().email, "admin@x.com");
    assert_eq!(rs.first().unwrap().roles, vec![NotificationRole::Admin]);
    assert!(!rs.first().unwrap().is_high_priority());
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
    assert_eq!(rs.first().unwrap().email, "admin@x.com");
}

#[test]
fn merged_roles_get_high_priority() {
    // 父级评论作者 == 文章作者 -> 合并为一条高优先级
    let n = notification("user@x.com", Some("admin@x.com"));
    let rs = build_recipients(&n, "admin@x.com");
    assert_eq!(rs.len(), 1, "must merge admin + parent author");
    assert_eq!(rs.first().unwrap().email, "admin@x.com");
    assert!(rs.first().unwrap().is_high_priority());
    assert!(rs.first().unwrap().roles.contains(&NotificationRole::Admin));
    assert!(
        rs.first()
            .unwrap()
            .roles
            .contains(&NotificationRole::ParentAuthor)
    );
}

#[test]
fn email_case_insensitive_dedup() {
    let n = notification("user@x.com", Some("Admin@X.com"));
    let rs = build_recipients(&n, "ADMIN@X.com");
    assert_eq!(rs.len(), 1);
    assert!(rs.first().unwrap().is_high_priority());
}
