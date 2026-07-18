//! Email notification templates

use super::notification::{AdminEmailConfig, CommentNotification};
use super::notification_recipients::{NotificationRecipient, NotificationRole};
use chrono::Datelike;

/// 生成评论通知跳转 URL。
///
/// 当 `parent_comment_id` 存在时（即回复场景），追加 `?comment=<父级id>#comment-<父级id>`，
/// 前端据此滚动定位到「直接父级评论」、高亮并在其下方展开回复输入框——
/// 而非定位到根评论或新回复本身。
pub fn generate_notification_url(
    site_url: &str,
    ref_type: &str,
    ref_id: &str,
    ref_title: Option<&str>,
    parent_comment_id: Option<&str>,
) -> String {
    let base = match ref_type {
        "post" | "posts" => {
            if let Some(slug) = ref_title {
                format!("{}/archives/{}", site_url, slug)
            } else {
                format!("{}/archives/{}", site_url, ref_id)
            }
        }
        "note" | "notes" => {
            if let Some(slug) = ref_title {
                format!("{}/notes/{}", site_url, slug)
            } else {
                format!("{}/notes/{}", site_url, ref_id)
            }
        }
        "page" | "pages" => {
            if let Some(slug) = ref_title {
                format!("{}/{}", site_url, slug)
            } else {
                site_url.to_string()
            }
        }
        _ => site_url.to_string(),
    };

    if let Some(pid) = parent_comment_id.filter(|s| !s.is_empty()) {
        format!("{}?comment={}#comment-{}", base, pid, pid)
    } else {
        base
    }
}

fn ref_type_name(ref_type: &str) -> &'static str {
    match ref_type {
        "post" | "posts" => "文章",
        "note" | "notes" => "动态",
        "page" | "pages" => "页面",
        _ => "内容",
    }
}

/// 收件人视角的文案派生——根据角色与优先级生成标题、引导语、CTA。
///
/// - Admin（仅文章作者）：通用「新评论/新回复通知」。
/// - ParentAuthor（仅被回复者）：「X 回复了你的评论」，CTA 引导回到父级并回复。
/// - 合并角色（高优先级）：「X 回复了你的评论」（你既是作者也被回复），标题前缀 [重要]。
struct EmailView {
    /// 邮件标题（不含站点前缀，由调用方拼接）
    subject: String,
    /// HTML 引导语段
    intro_html: String,
    /// 纯文本引导语
    intro_text: String,
    /// CTA 按钮文案
    cta: String,
    /// 是否高优先级（用于标题 [重要] 前缀）
    high_priority: bool,
}

fn build_email_view(notification: &CommentNotification, recipient: &NotificationRecipient) -> EmailView {
    let is_parent_author = recipient.roles.contains(&NotificationRole::ParentAuthor);
    let high_priority = recipient.is_high_priority();

    if is_parent_author {
        // 被回复者视角：精准指向直接父级评论
        let subject = format!("{} 回复了你的评论", notification.author);
        let intro_html = format!(
            "<strong>{author}</strong> 回复了你在 <strong>{ref}</strong> 中的评论：",
            author = html_escape::encode_text(&notification.author),
            ref = ref_type_name(&notification.ref_type),
        );
        let intro_text = format!(
            "{} 回复了你在 {} 中的评论：\n\n",
            notification.author,
            ref_type_name(&notification.ref_type),
        );
        return EmailView {
            subject,
            intro_html,
            intro_text,
            cta: "查看并回复".to_string(),
            high_priority,
        };
    }

    // admin 默认视角
    let comment_type = if notification.is_reply { "回复" } else { "评论" };
    EmailView {
        subject: format!("新{}: {}", comment_type, notification.author),
        intro_html: format!(
            "<strong>{author}</strong> 在 <strong>{ref}</strong> 中留下了新的{ct}：",
            author = html_escape::encode_text(&notification.author),
            ref = ref_type_name(&notification.ref_type),
            ct = comment_type,
        ),
        intro_text: format!(
            "{} 在 {} 中留下了新的{}：\n\n",
            notification.author,
            ref_type_name(&notification.ref_type),
            comment_type,
        ),
        cta: format!("查看{}", comment_type),
        high_priority,
    }
}

/// Build HTML email body for comment notification
pub fn build_html_email(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    notification_url: &str,
    recipient: &NotificationRecipient,
) -> String {
    let view = build_email_view(notification, recipient);
    // 回复对象信息——站点风格的轻量胶囊标签，而非粗体段落
    let parent_info = notification.parent_author.as_ref().map_or(String::new(), |parent| {
        format!(
            "<span class=\"chip\">回复给 <strong>{parent}</strong></span>",
            parent = html_escape::encode_text(parent),
        )
    });
    let location_info = notification.location.as_ref().map_or(String::new(), |loc| {
        format!("<li>来自 {loc}</li>", loc = html_escape::encode_text(loc))
    });
    let ua_info = notification.ua.as_ref().map_or(String::new(), |ua| {
        format!("<li>{ua}</li>", ua = html_escape::encode_text(ua))
    });
    let created_formatted = notification
        .created
        .to_chrono()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    // 高优先级（多身份合并）——顶部青绿细条提到完全不透明，并加「重要」徽章
    let accent_bar_opacity = if view.high_priority { "1" } else { "0.6" };
    let priority_badge = if view.high_priority {
        "<span class=\"badge\">重要</span>"
    } else {
        ""
    };

    format!(
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <title>{subject}</title>
    <style>
        /* 对齐站点 Stone + Teal 设计系统（参见 apps/web globals.css） */
        body {{ margin: 0; padding: 0; background: #f5f5f4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: #1c1917; -webkit-font-smoothing: antialiased; }}
        .page {{ padding: 40px 16px; }}
        .card {{ max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.08); }}
        /* 站点签名：顶部青绿渐变细条（from-accent-400 via-accent-500 to-accent-400） */
        .accent-bar {{ height: 4px; background: linear-gradient(90deg, #2dd4bf 0%, #14b8a6 50%, #2dd4bf 100%); }}
        .header {{ padding: 32px 32px 8px; }}
        .eyebrow {{ font-size: 12px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #0d9488; margin: 0 0 8px; }}
        h1 {{ font-family: Georgia, "Times New Roman", ui-serif, serif; font-size: 22px; line-height: 1.4; font-weight: 600; margin: 0; color: #1c1917; letter-spacing: -0.01em; }}
        .badge {{ display: inline-block; vertical-align: middle; margin-left: 10px; padding: 2px 10px; font-size: 12px; font-weight: 600; color: #ffffff; background: #0d9488; border-radius: 999px; letter-spacing: 0.05em; }}
        .body {{ padding: 20px 32px 32px; line-height: 1.6; }}
        .intro {{ font-size: 15px; color: #44403c; margin: 0 0 20px; }}
        .intro strong {{ color: #1c1917; font-weight: 600; }}
        .chip {{ display: inline-block; padding: 4px 12px; font-size: 13px; color: #115e59; background: #ccfbf1; border-radius: 999px; margin: 0 0 16px; }}
        .chip strong {{ font-weight: 600; }}
        /* 评论卡片：accent-50 底 + accent-600 左边框，呼应站点 comment-box 语义 */
        .comment-box {{ background: #f0fdfa; border-left: 3px solid #0d9488; padding: 18px 20px; margin: 16px 0 24px; border-radius: 0 10px 10px 0; }}
        .comment-box p {{ margin: 0; font-size: 15px; line-height: 1.7; color: #1c1917; white-space: pre-wrap; word-break: break-word; }}
        .meta {{ list-style: none; padding: 0; margin: 0 0 24px; font-size: 13px; color: #57534e; }}
        .meta li {{ padding: 2px 0; }}
        .meta li::before {{ content: "·"; color: #d6d3d1; margin-right: 8px; }}
        /* 主按钮：accent-600 / hover accent-500，圆角 10px（--radius） */
        .button {{ display: inline-block; padding: 12px 28px; background: #0d9488; color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; }}
        .footer {{ padding: 20px 32px; border-top: 1px solid #e7e5e4; font-size: 12px; color: #78716c; text-align: center; }}
        .footer a {{ color: #0d9488; text-decoration: none; }}
        @media (max-width: 520px) {{
            .header, .body {{ padding-left: 20px; padding-right: 20px; }}
            h1 {{ font-size: 20px; }}
        }}
    </style>
</head>
<body>
    <div class="page">
        <div class="card">
            <div class="accent-bar" style="opacity:{accent_bar_opacity}"></div>
            <div class="header">
                <p class="eyebrow">{site_name} · 评论通知</p>
                <h1>{subject}{priority_badge}</h1>
            </div>
            <div class="body">
                <p class="intro">{intro_html}</p>
                {parent_info}
                <div class="comment-box">
                    <p>{comment_text}</p>
                </div>
                <ul class="meta">
                    <li>邮箱 {email}</li>
                    <li>时间 {created}</li>
                    {location_info}
                    {ua_info}
                </ul>
                <a href="{notification_url}" class="button">{cta}</a>
            </div>
            <div class="footer">
                <p>© {year} {site_name} · Powered by Neo Space</p>
            </div>
        </div>
    </div>
</body>
</html>"#,
        subject = html_escape::encode_text(&view.subject),
        accent_bar_opacity = accent_bar_opacity,
        priority_badge = priority_badge,
        site_name = html_escape::encode_text(&config.site_name),
        intro_html = view.intro_html,
        parent_info = parent_info,
        comment_text = html_escape::encode_text(&notification.text),
        email = html_escape::encode_text(&notification.email),
        created = created_formatted,
        location_info = location_info,
        ua_info = ua_info,
        cta = html_escape::encode_text(&view.cta),
        notification_url = html_escape::encode_text(notification_url),
        year = chrono::Utc::now().year(),
    )
}

/// Build plain text email body
pub fn build_text_email(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    notification_url: &str,
    recipient: &NotificationRecipient,
) -> String {
    let view = build_email_view(notification, recipient);
    let parent_info = notification.parent_author.as_ref().map_or(String::new(), |parent| {
        format!("回复给: {}\n", parent)
    });
    let location_info = notification.location.as_ref().map_or(String::new(), |loc| {
        format!("来自: {}\n", loc)
    });
    let created_formatted = notification
        .created
        .to_chrono()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let subject_prefix = if view.high_priority { "【重要】" } else { "" };

    format!(
        "{prefix}{subject}\n\n\
        {intro}\
        {parent_info}\
        {text}\n\n\
        邮箱: {email}\n\
        时间: {created}\n\
        {location_info}\
        查看链接: {url}\n\n\
        © {year} {site_name} · Powered by Neo Space",
        prefix = subject_prefix,
        subject = view.subject,
        intro = view.intro_text,
        parent_info = parent_info,
        text = notification.text,
        email = notification.email,
        created = created_formatted,
        location_info = location_info,
        url = notification_url,
        year = chrono::Utc::now().year(),
        site_name = config.site_name,
    )
}

/// 构造邮件 Subject 头——站点前缀 + 高优先级标记 + 收件人视角标题。
pub fn build_subject(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    recipient: &NotificationRecipient,
) -> String {
    let view = build_email_view(notification, recipient);
    if view.high_priority {
        format!("[{}] 【重要】{}", config.site_name, view.subject)
    } else {
        format!("[{}] {}", config.site_name, view.subject)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::notification_recipients::NotificationPriority;
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
        let html = build_html_email(&n, &cfg, "https://example.com/?comment=x#comment-x", &recipient(&[NotificationRole::Admin]));

        // 站点 Stone + Teal 设计 token 必须出现
        assert!(html.contains("#f5f5f4"), "page background must use Stone-100");
        assert!(html.contains("#0d9488"), "accent must use Teal-600");
        assert!(html.contains("#14b8a6"), "accent bar must use Teal-500");
        assert!(html.contains("#1c1917"), "text must use Stone-900");
        assert!(html.contains("#57534e"), "muted text must use Stone-600");
        // 紫色旧配色必须被彻底移除
        assert!(!html.contains("#667eea"), "must not retain old purple gradient");
        assert!(!html.contains("#764ba2"), "must not retain old purple gradient");
        // 签名顶部细条 + serif 标题
        assert!(html.contains("accent-bar"), "must include site signature accent bar");
        assert!(html.contains("Georgia"), "headings must use serif font");
        // 行高 1.6（站点排版规范）
        assert!(html.contains("1.6"), "body must follow site 1.6 line-height");
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

        assert!(html.contains("class=\"badge\">重要</span>"), "high priority must render badge");
        assert!(html.contains("opacity:1"), "high priority accent bar must be fully opaque");
        // 回复场景必须渲染「回复给」胶囊与父级深链锚点
        assert!(html.contains("回复给"), "reply must show parent chip");
        assert!(html.contains("#comment-parent-id"), "deep link must point to direct parent");
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

        assert!(!html.contains("class=\"badge\">重要</span>"), "normal priority must not show badge");
        assert!(html.contains("opacity:0.6"), "normal accent bar must be at 60% opacity");
    }
}
