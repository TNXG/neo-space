use super::validate_link_notification;

#[test]
fn rejects_empty_owner_notification() {
    assert!(validate_link_notification("", "content").is_err());
    assert!(validate_link_notification("subject", "  ").is_err());
    assert!(validate_link_notification("subject\ninjection", "content").is_err());
}

#[test]
fn accepts_reviewed_owner_notification() {
    assert!(validate_link_notification("友链沟通", "这是一封由博主确认的邮件。").is_ok());
}
