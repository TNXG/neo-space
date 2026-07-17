//! 修复旧版本搜索管理数据中的字符串日期。

use bson::{Document, doc};
use mongodb::Database;

const DATE_FIELDS: [(&str, &[&str]); 3] = [
    (
        "search_maintenance_tasks",
        &["createdAt", "updatedAt", "startedAt", "finishedAt"],
    ),
    ("search_maintenance_schedules", &["nextRunAt", "updatedAt"]),
    (
        "search_sync_events",
        &["nextAttemptAt", "createdAt", "updatedAt"],
    ),
];

/// 将旧版 HTTP 序列化器写入的 RFC 3339 字符串转换回 BSON Date。
pub async fn migrate_search_management_dates(
    database: &Database,
) -> Result<(), mongodb::error::Error> {
    for (collection_name, fields) in DATE_FIELDS {
        let collection = database.collection::<Document>(collection_name);
        for &field in fields {
            let field_reference = format!("${field}");
            collection
                .update_many(
                    doc! { field: { "$type": "string" } },
                    vec![doc! { "$set": {
                        field: { "$convert": {
                            "input": field_reference.clone(),
                            "to": "date",
                            "onError": field_reference,
                            "onNull": null,
                        } }
                    } }],
                )
                .await?;
        }
    }
    Ok(())
}
