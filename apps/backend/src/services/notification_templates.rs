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
        "post" | "posts" => ref_title.map_or_else(
            || format!("{site_url}/archives/{ref_id}"),
            |slug| format!("{site_url}/archives/{slug}"),
        ),
        "note" | "notes" => ref_title.map_or_else(
            || format!("{site_url}/notes/{ref_id}"),
            |slug| format!("{site_url}/notes/{slug}"),
        ),
        "page" | "pages" => {
            ref_title.map_or_else(|| site_url.to_string(), |slug| format!("{site_url}/{slug}"))
        }
        _ => site_url.to_string(),
    };

    if let Some(pid) = parent_comment_id.filter(|s| !s.is_empty()) {
        format!("{base}?comment={pid}#comment-{pid}")
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
        cta: format!("查看{comment_type}"),
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
        .map_or(String::new(), |parent| format!("回复给: {parent}\n"));
    let location_info = notification
        .location
        .as_ref()
        .map_or(String::new(), |loc| format!("来自: {loc}\n"));
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
#[path = "../../tests/unit/notification_templates.rs"]
mod tests;
