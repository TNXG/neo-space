//! Email notification templates

use super::notification::{AdminEmailConfig, CommentNotification};
use chrono::Datelike;

/// Generate notification URL for the comment
pub fn generate_notification_url(
    site_url: &str,
    ref_type: &str,
    ref_id: &str,
    ref_title: Option<&str>,
) -> String {
    match ref_type {
        "post" => {
            if let Some(slug) = ref_title {
                format!("{}/archives/{}", site_url, slug)
            } else {
                format!("{}/archives/{}", site_url, ref_id)
            }
        }
        "note" => {
            if let Some(slug) = ref_title {
                format!("{}/notes/{}", site_url, slug)
            } else {
                format!("{}/notes/{}", site_url, ref_id)
            }
        }
        _ => site_url.to_string(),
    }
}

/// Build HTML email body for comment notification
pub fn build_html_email(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    notification_url: &str,
) -> String {
    let comment_type = if notification.is_reply {
        "回复"
    } else {
        "评论"
    };
    let parent_info = if let Some(parent) = &notification.parent_author {
        format!("<p><strong>回复给:</strong> {}</p>", parent)
    } else {
        String::new()
    };

    let location_info = if let Some(loc) = &notification.location {
        format!("<p><strong>来自:</strong> {}</p>", loc)
    } else {
        String::new()
    };

    let ua_info = if let Some(ua) = &notification.ua {
        format!("<p><strong>浏览器:</strong> {}</p>", ua)
    } else {
        String::new()
    };

    let created_formatted = notification
        .created
        .to_chrono()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f4f7f6; }}
        .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white; }}
        .content {{ padding: 40px 30px; }}
        .comment-box {{ background: #f9fafb; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 0 8px 8px 0; }}
        .meta {{ font-size: 13px; color: #6b7280; margin-top: 10px; }}
        .button {{ display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; margin: 20px 0; }}
        .footer {{ background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
        .label {{ color: #6b7280; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>新{comment_type}通知</h1>
        </div>
        <div class="content">
            <p><strong>{author}</strong> 在 <strong>{ref_type_name}</strong> 中留下了新的{comment_type}：</p>

            {parent_info}
            <div class="comment-box">
                <p style="margin: 0;">{comment_text}</p>
            </div>

            <div class="meta">
                <p class="label">邮箱: {email}</p>
                <p class="label">时间: {created}</p>
                {location_info}
                {ua_info}
            </div>

            <a href="{notification_url}" class="button">查看{comment_type}</a>
        </div>
        <div class="footer">
            <p>© {year} {site_name} · Powered by Neo Space</p>
        </div>
    </div>
</body>
</html>"#,
        comment_type = comment_type,
        author = html_escape::encode_text(&notification.author),
        ref_type_name = if notification.ref_type == "post" {
            "文章"
        } else {
            "动态"
        },
        parent_info = parent_info,
        comment_text = html_escape::encode_text(&notification.text),
        email = html_escape::encode_text(&notification.email),
        created = created_formatted,
        location_info = location_info,
        ua_info = ua_info,
        notification_url = notification_url,
        year = chrono::Utc::now().year(),
        site_name = html_escape::encode_text(&config.site_name),
    )
}

/// Build plain text email body
pub fn build_text_email(
    notification: &CommentNotification,
    config: &AdminEmailConfig,
    notification_url: &str,
) -> String {
    let comment_type = if notification.is_reply {
        "回复"
    } else {
        "评论"
    };
    let parent_info = if let Some(parent) = &notification.parent_author {
        format!("回复给: {}\n", parent)
    } else {
        String::new()
    };

    let location_info = if let Some(loc) = &notification.location {
        format!("来自: {}\n", loc)
    } else {
        String::new()
    };

    let created_formatted = notification
        .created
        .to_chrono()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    format!(
        "新{}通知\n\n\
        {} 在 {} 中留下了新的{}：\n\n\
        {}\n\
        {}\n\
        邮箱: {}\n\
        时间: {}\n\
        {}\
        \n\
        查看链接: {}\n\n\
        © {} {} · Powered by Neo Space",
        comment_type,
        notification.author,
        if notification.ref_type == "post" {
            "文章"
        } else {
            "动态"
        },
        comment_type,
        parent_info,
        notification.text,
        notification.email,
        created_formatted,
        location_info,
        notification_url,
        chrono::Utc::now().year(),
        config.site_name,
    )
}
