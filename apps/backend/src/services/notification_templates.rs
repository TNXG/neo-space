//! Email notification templates

use super::notification::{AdminEmailConfig, CommentNotification};
use super::notification_recipients::{NotificationRecipient, NotificationRole};
use crate::external::email_templates::{BrandedEmailTemplate, build_branded_html, render_template};
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
    /// 邮件客户端显示的 Subject。
    mail_subject: String,
    /// HTML 引导语段
    intro_html: String,
    /// 纯文本引导语
    intro_text: String,
    /// CTA 按钮文案
    cta: String,
    /// 是否高优先级（用于标题 [重要] 前缀）
    high_priority: bool,
}

fn build_email_view(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    recipient: &NotificationRecipient,
) -> EmailView {
    let is_parent_author = recipient.roles.contains(&NotificationRole::ParentAuthor);
    let high_priority = recipient.is_high_priority();

    if is_parent_author {
        // 被回复者视角：精准指向直接父级评论。
        let variables = [
            ("site_name", config.site_name.as_str()),
            ("author", notification.author.as_str()),
            ("ref_type", ref_type_name(&notification.ref_type)),
            ("comment_type", "回复"),
        ];
        let subject = render_template(&config.email_templates.reply_title, &variables);
        let mail_subject = render_template(&config.email_templates.reply_subject, &variables);
        let intro_html = html_escape::encode_text(&render_template(
            &config.email_templates.reply_intro,
            &variables,
        ))
        .into_owned();
        let intro_text = format!(
            "{} 回复了你在 {} 中的评论：\n\n",
            notification.author,
            ref_type_name(&notification.ref_type),
        );
        return EmailView {
            subject,
            mail_subject,
            intro_html,
            intro_text,
            cta: "查看并回复".to_string(),
            high_priority,
        };
    }

    // admin 默认视角
    let comment_type = if notification.is_reply {
        "回复"
    } else {
        "评论"
    };
    let variables = [
        ("site_name", config.site_name.as_str()),
        ("author", notification.author.as_str()),
        ("ref_type", ref_type_name(&notification.ref_type)),
        ("comment_type", comment_type),
    ];
    EmailView {
        subject: render_template(&config.email_templates.comment_title, &variables),
        mail_subject: render_template(&config.email_templates.comment_subject, &variables),
        intro_html: html_escape::encode_text(&render_template(
            &config.email_templates.comment_intro,
            &variables,
        ))
        .into_owned(),
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

/// 构建评论通知的品牌 HTML 邮件。
pub fn build_html_email(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    notification_url: &str,
    recipient: &NotificationRecipient,
) -> String {
    let view = build_email_view(notification, config, recipient);
    // 回复对象信息使用站点风格的轻量胶囊，避免抢夺正文层级。
    let parent_info = notification.parent_author.as_ref().map_or(String::new(), |parent| {
        format!(
            "<span class=\"chip\" style=\"display:inline-block;margin:0 0 16px;padding:4px 12px;background-color:#ccfbf1;border-radius:999px;color:#115e59;font-size:13px;line-height:1.5;\">回复给 <strong>{parent}</strong></span>",
            parent = html_escape::encode_text(parent),
        )
    });
    let location_info = notification.location.as_ref().map_or(String::new(), |loc| {
        format!(
            "<tr><td style=\"padding:2px 0;color:#57534e;font-size:13px;line-height:1.6;\">来自 {loc}</td></tr>",
            loc = html_escape::encode_text(loc),
        )
    });
    let ua_info = notification.ua.as_ref().map_or(String::new(), |ua| {
        format!(
            "<tr><td style=\"padding:2px 0;color:#57534e;font-size:13px;line-height:1.6;\">设备 {ua}</td></tr>",
            ua = html_escape::encode_text(ua),
        )
    });
    let created_formatted = notification
        .created
        .to_chrono()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    // 多身份合并邮件提高品牌条不透明度，并明确标记优先级。
    let accent_bar_opacity = if view.high_priority { "1" } else { "0.6" };
    let priority_badge = if view.high_priority {
        "<span class=\"badge\" style=\"display:inline-block;margin:0 0 16px;padding:3px 10px;background-color:#0d9488;border-radius:999px;color:#ffffff;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:0.05em;\">重要通知</span>"
    } else {
        ""
    };
    let comment_text = html_escape::encode_text(&notification.text).replace('\n', "<br>");
    let content_html = format!(
        r##"{priority_badge}
<p style="margin:0 0 20px;color:#44403c;font-size:15px;line-height:1.6;">{intro_html}</p>
{parent_info}
<div style="margin:0 0 22px;padding:18px 20px;background-color:#f0fdfa;border-left:3px solid #0d9488;border-radius:0 10px 10px 0;color:#1c1917;font-size:15px;line-height:1.6;word-break:break-word;">{comment_text}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 24px;border-collapse:collapse;">
  <tr><td style="padding:2px 0;color:#57534e;font-size:13px;line-height:1.6;">邮箱 {email}</td></tr>
  <tr><td style="padding:2px 0;color:#57534e;font-size:13px;line-height:1.6;">时间 {created}</td></tr>
  {location_info}
  {ua_info}
</table>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
  <tr>
    <td align="center" bgcolor="#0d9488" style="border-radius:10px;background-color:#0d9488;">
      <a href="{notification_url}" style="display:inline-block;padding:12px 26px;color:#ffffff;font-size:15px;line-height:1.2;font-weight:700;text-decoration:none;border-radius:10px;">{cta}</a>
    </td>
  </tr>
</table>"##,
        priority_badge = priority_badge,
        intro_html = view.intro_html,
        parent_info = parent_info,
        comment_text = comment_text,
        email = html_escape::encode_text(&notification.email),
        created = created_formatted,
        location_info = location_info,
        ua_info = ua_info,
        cta = html_escape::encode_text(&view.cta),
        notification_url = html_escape::encode_double_quoted_attribute(notification_url),
    );
    let comment_preview = notification
        .text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(96)
        .collect::<String>();
    let preheader = format!("{}：{}", view.subject, comment_preview);

    build_branded_html(BrandedEmailTemplate {
        site_name: &config.site_name,
        category: &config.email_templates.comment_category,
        title: &view.subject,
        preheader: &preheader,
        content_html: &content_html,
        accent_opacity: accent_bar_opacity,
        config: &config.email_templates,
    })
}

/// Build plain text email body
pub fn build_text_email(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    notification_url: &str,
    recipient: &NotificationRecipient,
) -> String {
    let view = build_email_view(notification, config, recipient);
    let parent_info = notification
        .parent_author
        .as_ref()
        .map_or(String::new(), |parent| format!("回复给: {}\n", parent));
    let location_info = notification
        .location
        .as_ref()
        .map_or(String::new(), |loc| format!("来自: {}\n", loc));
    let created_formatted = notification
        .created
        .to_chrono()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();
    let subject_prefix = if view.high_priority {
        "【重要】"
    } else {
        ""
    };

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
    let view = build_email_view(notification, config, recipient);
    if view.high_priority {
        format!("【重要】{}", view.mail_subject)
    } else {
        view.mail_subject
    }
}

#[cfg(test)]
mod tests {
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
}
