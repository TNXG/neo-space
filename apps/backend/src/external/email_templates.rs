//! 站点品牌邮件模板

use chrono::Datelike;

/// 品牌邮件骨架所需的展示内容。
pub(crate) struct BrandedEmailTemplate<'a> {
    pub site_name: &'a str,
    pub category: &'a str,
    pub title: &'a str,
    pub preheader: &'a str,
    /// 调用方必须先转义所有用户输入，仅允许传入受控 HTML。
    pub content_html: &'a str,
    pub accent_opacity: &'a str,
}

/// 构建兼容主流邮件客户端的品牌 HTML 外壳。
///
/// 邮件客户端会移除部分网页 CSS，因此布局使用 table，关键视觉样式全部内联。
pub(crate) fn build_branded_html(template: BrandedEmailTemplate<'_>) -> String {
    let site_name = html_escape::encode_text(template.site_name);
    let category = html_escape::encode_text(template.category);
    let title = html_escape::encode_text(template.title);
    let preheader = html_escape::encode_text(template.preheader);
    let year = chrono::Utc::now().year();

    format!(
        r#"<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>{title}</title>
  <style>
    @media only screen and (max-width: 620px) {{
      .email-shell {{ width: 100% !important; }}
      .email-page {{ padding: 20px 12px !important; }}
      .email-header {{ padding: 28px 22px 8px !important; }}
      .email-content {{ padding: 18px 22px 28px !important; }}
      .email-title {{ font-size: 24px !important; }}
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;color:#1c1917;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">{preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;background-color:#f5f5f4;">
    <tr>
      <td class="email-page" align="center" style="padding:40px 16px;">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:560px;max-width:560px;border-collapse:separate;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td class="accent-bar" height="4" style="height:4px;line-height:4px;font-size:0;background-color:#14b8a6;opacity:{accent_opacity};">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-header" style="padding:32px 32px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td width="42" valign="middle" style="width:42px;">
                    <div style="width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background-color:#0d9488;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;">N</div>
                  </td>
                  <td valign="middle" style="font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0d9488;">{site_name}<br><span style="font-weight:500;color:#78716c;letter-spacing:0.06em;">{category}</span></td>
                </tr>
              </table>
              <h1 class="email-title" style="margin:22px 0 0;color:#1c1917;font-family:Georgia,'Times New Roman','Songti SC',serif;font-size:28px;line-height:1.35;font-weight:600;letter-spacing:-0.02em;">{title}</h1>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:18px 32px 32px;font-size:15px;line-height:1.6;color:#44403c;">
              {content_html}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e7e5e4;text-align:center;color:#78716c;font-size:12px;line-height:1.6;">
              © {year} {site_name}<br>
              <span style="color:#a8a29e;">Powered by Neo Space</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"#,
        accent_opacity = template.accent_opacity,
        content_html = template.content_html,
    )
}

/// 构建验证码邮件的 HTML 内容。
pub fn build_verification_html(code: &str, site_name: &str) -> String {
    let escaped_code = html_escape::encode_text(code);
    let content_html = format!(
        r#"<p style="margin:0 0 20px;">你好，感谢你访问 <strong style="color:#1c1917;font-weight:600;">{site_name}</strong>。请使用下方验证码完成身份验证。</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;background-color:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;">
  <tr>
    <td align="center" style="padding:24px 16px 12px;color:#0d9488;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;line-height:1.2;font-weight:700;letter-spacing:0.18em;">{escaped_code}</td>
  </tr>
  <tr>
    <td align="center" style="padding:0 16px 22px;color:#57534e;font-size:12px;line-height:1.5;">验证码将在 10 分钟后失效</td>
  </tr>
</table>
<p style="margin:20px 0 0;padding:12px 14px;background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;color:#57534e;font-size:13px;line-height:1.6;">如果这不是你的操作，可以安全地忽略此邮件。请勿将验证码转发给他人。</p>"#,
        site_name = html_escape::encode_text(site_name),
    );

    build_branded_html(BrandedEmailTemplate {
        site_name,
        category: "安全验证",
        title: "验证你的邮箱",
        preheader: "使用邮件中的 6 位验证码完成身份验证，有效期 10 分钟。",
        content_html: &content_html,
        accent_opacity: "1",
    })
}

/// 构建博主手动邮件的 HTML 内容，并安全保留纯文本换行。
pub fn build_owner_html(subject: &str, content: &str, site_name: &str) -> String {
    let normalized_content = content.replace("\r\n", "\n").replace('\r', "\n");
    let escaped_content = html_escape::encode_text(&normalized_content).replace('\n', "<br>");
    let preheader = content
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("来自站点管理员的消息")
        .chars()
        .take(120)
        .collect::<String>();
    let content_html = format!(
        r#"<div style="padding:20px;background-color:#fafaf9;border:1px solid #e7e5e4;border-radius:12px;color:#292524;font-size:15px;line-height:1.6;word-break:break-word;">{escaped_content}</div>
<p style="margin:20px 0 0;color:#78716c;font-size:12px;line-height:1.6;">这封邮件由 {site_name} 的站点管理员发送。</p>"#,
        site_name = html_escape::encode_text(site_name),
    );

    build_branded_html(BrandedEmailTemplate {
        site_name,
        category: "站点来信",
        title: subject,
        preheader: &preheader,
        content_html: &content_html,
        accent_opacity: "0.72",
    })
}

/// 构建验证码邮件的纯文本降级内容。
pub fn build_verification_text(code: &str, site_name: &str) -> String {
    format!(
        "验证你的邮箱\n\n你的验证码是：{code}\n\n验证码将在 10 分钟后失效。请勿将验证码转发给他人。\n\n© {year} {site_name} · Powered by Neo Space",
        year = chrono::Utc::now().year(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verification_html_uses_brand_tokens_and_email_safe_layout() {
        let html = build_verification_html("123456", "Neo Space");

        assert!(html.contains("#f5f5f4"));
        assert!(html.contains("#0d9488"));
        assert!(html.contains("role=\"presentation\""));
        assert!(html.contains("123456"));
        assert!(!html.contains("linear-gradient"));
    }

    #[test]
    fn owner_html_escapes_user_content_and_keeps_line_breaks() {
        let html = build_owner_html(
            "友链申请结果",
            "你好\n<script>alert(1)</script>",
            "Neo Space",
        );

        assert!(html.contains("友链申请结果"));
        assert!(html.contains("你好<br>&lt;script&gt;alert(1)&lt;/script&gt;"));
        assert!(!html.contains("<script>alert(1)</script>"));
    }
}
