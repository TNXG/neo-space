use super::*;

#[test]
fn verification_html_uses_brand_tokens_and_email_safe_layout() {
    let html = build_verification_html("123456", "Neo Space", &EmailTemplateConfig::default());

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
        &EmailTemplateConfig::default(),
    );

    assert!(html.contains("友链申请结果"));
    assert!(html.contains("你好<br>&lt;script&gt;alert(1)&lt;/script&gt;"));
    assert!(!html.contains("<script>alert(1)</script>"));
}

#[test]
fn configuration_overrides_brand_and_verification_copy() {
    let mail_options = mongodb::bson::doc! {
        "templates": {
            "brand": { "logoText": "天", "footerText": "来自天翔的博客" },
            "verification": {
                "title": "确认邮箱地址",
                "intro": "欢迎来到 {{site_name}}，请输入验证码。"
            }
        }
    };
    let config = EmailTemplateConfig::from_mail_options(&mail_options);
    let html = build_verification_html("654321", "Neo Space", &config);

    assert!(html.contains("确认邮箱地址"));
    assert!(html.contains("欢迎来到 Neo Space，请输入验证码。"));
    assert!(html.contains("来自天翔的博客"));
    assert!(html.contains(">天</div>"));
}
