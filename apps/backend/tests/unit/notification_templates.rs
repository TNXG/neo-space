use super::super::notification_recipients::NotificationPriority;
use super::*;
use crate::services::notification::AdminEmailConfig;

fn sample_notification(is_reply: bool) -> CommentNotification {
    CommentNotification {
        comment_id: "64b7f1c2a1b2c3d4e5f6a7b8".to_string(),
        author: "tester".to_string(),
        text: "你好呀".to_string(),
        email: "user@x.com".to_string(),
        ref_type: "posts".to_string(),
        ref_id: "ref".to_string(),
        ref_title: None,
        created: bson::DateTime::now(),
        is_reply,
        parent_comment_id: is_reply.then(|| "parent-id".to_string()),
        parent_author: is_reply.then(|| "parent".to_string()),
        parent_author_email: is_reply.then(|| "parent@x.com".to_string()),
        ua: Some("Mac OS X | Safari".to_string()),
        location: Some("上海".to_string()),
    }
}

fn admin_config() -> AdminEmailConfig {
    AdminEmailConfig {
        email: "admin@x.com".to_string(),
        site_name: "Neo Space".to_string(),
        site_url: "https://example.com".to_string(),
        email_templates: crate::external::email_templates::EmailTemplateConfig::default(),
    }
}

fn recipient(roles: &[NotificationRole]) -> NotificationRecipient {
    let priority = if roles.len() > 1 {
        NotificationPriority::High
    } else {
        NotificationPriority::Normal
    };
    NotificationRecipient {
        email: "admin@x.com".to_string(),
        roles: roles.to_vec(),
        priority,
    }
}

#[test]
fn html_uses_site_stone_teal_palette_not_purple() {
    let n = sample_notification(false);
    let cfg = admin_config();
    let html = build_html_email(
        &n,
        &cfg,
        "https://example.com/?comment=x#comment-x",
        &recipient(&[NotificationRole::Admin]),
    );

    // 站点 Stone + Teal 设计 token 必须出现
    assert!(
        html.contains("#f5f5f4"),
        "page background must use Stone-100"
    );
    assert!(html.contains("#0d9488"), "accent must use Teal-600");
    assert!(html.contains("#14b8a6"), "accent bar must use Teal-500");
    assert!(html.contains("#1c1917"), "text must use Stone-900");
    assert!(html.contains("#57534e"), "muted text must use Stone-600");
    // 紫色旧配色必须被彻底移除
    assert!(
        !html.contains("#667eea"),
        "must not retain old purple gradient"
    );
    assert!(
        !html.contains("#764ba2"),
        "must not retain old purple gradient"
    );
    // 签名顶部细条 + serif 标题
    assert!(
        html.contains("accent-bar"),
        "must include site signature accent bar"
    );
    assert!(html.contains("Georgia"), "headings must use serif font");
    // 行高 1.6（站点排版规范）
    assert!(
        html.contains("1.6"),
        "body must follow site 1.6 line-height"
    );
}

#[test]
fn html_high_priority_shows_badge_and_opaque_bar() {
    let n = sample_notification(true);
    let cfg = admin_config();
    let html = build_html_email(
        &n,
        &cfg,
        "https://example.com/?comment=parent-id#comment-parent-id",
        &recipient(&[NotificationRole::Admin, NotificationRole::ParentAuthor]),
    );

    assert!(
        html.contains("class=\"badge\""),
        "high priority must render badge"
    );
    assert!(
        html.contains("重要通知"),
        "high priority badge must be explicit"
    );
    assert!(
        html.contains("opacity:1"),
        "high priority accent bar must be fully opaque"
    );
    // 回复场景必须渲染「回复给」胶囊与父级深链锚点
    assert!(html.contains("回复给"), "reply must show parent chip");
    assert!(
        html.contains("#comment-parent-id"),
        "deep link must point to direct parent"
    );
}

#[test]
fn html_normal_priority_has_no_badge_and_dim_bar() {
    let n = sample_notification(true);
    let cfg = admin_config();
    let html = build_html_email(
        &n,
        &cfg,
        "https://example.com/?comment=parent-id#comment-parent-id",
        &recipient(&[NotificationRole::ParentAuthor]),
    );

    assert!(
        !html.contains("class=\"badge\""),
        "normal priority must not show badge"
    );
    assert!(
        html.contains("opacity:0.6"),
        "normal accent bar must be at 60% opacity"
    );
}

#[test]
fn configured_subject_and_title_are_rendered() {
    let notification = sample_notification(false);
    let mut config = admin_config();
    config.email_templates.comment_subject =
        "{{site_name}} 有来自 {{author}} 的{{comment_type}}".to_string();
    config.email_templates.comment_title = "收到一条{{comment_type}}".to_string();
    let recipient = recipient(&[NotificationRole::Admin]);

    assert_eq!(
        build_subject(&notification, &config, &recipient),
        "Neo Space 有来自 tester 的评论"
    );
    assert!(
        build_html_email(&notification, &config, "https://example.com", &recipient)
            .contains("收到一条评论")
    );
}
