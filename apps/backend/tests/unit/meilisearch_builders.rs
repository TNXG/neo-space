use super::build_search_document_id;

/// 验证复合文档主键符合 Meilisearch 的字符约束。
#[test]
fn builds_meilisearch_compatible_document_id() {
    let document_id = build_search_document_id("507f1f77bcf86cd799439011", "zh-CN");

    assert_eq!(document_id, "507f1f77bcf86cd799439011_zh-CN");
    assert!(
        document_id.chars().all(
            |character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_')
        )
    );
}
