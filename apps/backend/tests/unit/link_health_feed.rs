use super::{strip_html, truncate};

#[test]
fn strips_tags_and_entities() {
    assert_eq!(strip_html("<p>Hello&nbsp;<b>world</b></p>"), "Hello world");
}

#[test]
fn truncates_by_chars() {
    assert_eq!(truncate("你好世界", 2), "你好…");
    assert_eq!(truncate(" ok ", 5), "ok");
}
