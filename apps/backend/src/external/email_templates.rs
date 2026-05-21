//! Email templates for verification codes

use chrono::Datelike;

/// Build HTML template for verification code email
pub fn build_verification_html(code: &str, site_name: &str) -> String {
    format!(
        r#"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{ margin: 0; padding: 0; font-family: -apple-system, sans-serif; background: #f4f7f6; }}
        .container {{ max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }}
        .header {{ background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 30px; text-align: center; color: white; }}
        .content {{ padding: 40px 30px; }}
        .code-container {{ background: #f0fdfa; border: 2px dashed #14b8a6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }}
        .code {{ font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px; }}
        .footer {{ background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>验证码</h1></div>
        <div class="content">
            <p>你好！</p>
            <p>感谢你访问 <strong>{site_name}</strong>。请使用下方的验证码完成操作：</p>
            <div class="code-container">
                <div class="code">{code}</div>
                <p style="font-size: 12px; color: #666;">有效期 10 分钟</p>
            </div>
            <p style="color: #92400e; font-size: 13px;">⚠️ 如果非本人操作，请忽略此邮件。</p>
        </div>
        <div class="footer">
            <p>© {year} {site_name} · Powered by Neo Space</p>
        </div>
    </div>
</body>
</html>
"#,
        site_name = site_name,
        code = code,
        year = chrono::Utc::now().year()
    )
}

/// Build plain text template for verification code email
pub fn build_verification_text(code: &str, site_name: &str) -> String {
    format!(
        "你好！\n\n你的验证码是：{code}\n\n有效期 10 分钟。\n\n© {year} {site_name}",
        code = code,
        year = chrono::Utc::now().year(),
        site_name = site_name
    )
}
