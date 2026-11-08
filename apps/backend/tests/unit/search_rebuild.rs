use bson::oid::ObjectId;
use serde_json::json;

use crate::error::AppResult;

use super::build_rebuild_indexes;

/// 验证重建会包含任意正式索引并排除历史临时索引。
#[test]
fn builds_targets_for_all_formal_indexes() -> AppResult<()> {
    let task_id = ObjectId::from_bytes([1; 12]);
    let indexes = vec![
        json!({ "uid": "posts", "primaryKey": "id" }),
        json!({ "uid": "products", "primaryKey": "sku" }),
        json!({
            "uid": "notes__rebuild_507f1f77bcf86cd799439012",
            "primaryKey": "id"
        }),
    ];

    let targets = build_rebuild_indexes(&indexes, task_id)?;

    assert_eq!(targets.len(), 2);
    assert!(targets.iter().any(|target| target.uid == "posts"));
    assert!(targets.iter().any(|target| target.uid == "products"));
    assert!(
        targets
            .iter()
            .all(|target| target.temporary_uid.ends_with(&task_id.to_hex()))
    );
    Ok(())
}
