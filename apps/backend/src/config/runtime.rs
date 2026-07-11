//! 数据库优先的运行时配置迁移与加载。

use bson::{Bson, Document, doc};
use mongodb::Database;

use super::AppConfig;

const UNUSED_OPTIONS: &[&str] = &[
    "adminExtra",
    "algoliaSearchOptions",
    "apiCallTime",
    "authSecurity",
    "backupOptions",
    "bingSearchOptions",
    "featureList",
    "like",
    "thirdPartyServiceIntegration",
    "uv",
];

async fn ensure_field(
    database: &Database,
    option_name: &str,
    field_path: &str,
    value: impl Into<Bson>,
) -> Result<(), mongodb::error::Error> {
    let collection = database.collection::<Document>("options");
    let full_path = format!("value.{field_path}");
    collection
        .update_one(
            doc! { "name": option_name },
            doc! { "$setOnInsert": { "name": option_name, "value": {} } },
        )
        .upsert(true)
        .await?;

    let mut filter = doc! { "name": option_name };
    filter.insert(full_path.clone(), doc! { "$exists": false });
    let mut fields = Document::new();
    fields.insert(full_path, value.into());

    collection
        .update_one(filter, doc! { "$set": fields })
        .await?;
    Ok(())
}

fn nested_string(document: &Document, path: &[&str]) -> Option<String> {
    let (head, tail) = path.split_first()?;
    let value = document.get(*head)?;
    if tail.is_empty() {
        return value.as_str().map(ToString::to_string);
    }
    value
        .as_document()
        .and_then(|nested| nested_string(nested, tail))
}

fn nested_u64(document: &Document, path: &[&str]) -> Option<u64> {
    let (head, tail) = path.split_first()?;
    let value = document.get(*head)?;
    if !tail.is_empty() {
        return value
            .as_document()
            .and_then(|nested| nested_u64(nested, tail));
    }
    value
        .as_i64()
        .or_else(|| value.as_i32().map(i64::from))
        .and_then(|number| u64::try_from(number).ok())
}

fn nested_bool(document: &Document, path: &[&str]) -> Option<bool> {
    let (head, tail) = path.split_first()?;
    let value = document.get(*head)?;
    if tail.is_empty() {
        return value.as_bool();
    }
    value
        .as_document()
        .and_then(|nested| nested_bool(nested, tail))
}

fn nested_strings(document: &Document, path: &[&str]) -> Option<Vec<String>> {
    let (head, tail) = path.split_first()?;
    let value = document.get(*head)?;
    if !tail.is_empty() {
        return value
            .as_document()
            .and_then(|nested| nested_strings(nested, tail));
    }
    value.as_array().map(|values| {
        values
            .iter()
            .filter_map(|value| value.as_str().map(ToString::to_string))
            .collect()
    })
}

async fn option_value(database: &Database, name: &str) -> Option<Document> {
    database
        .collection::<Document>("options")
        .find_one(doc! { "name": name })
        .await
        .ok()
        .flatten()
        .and_then(|document| document.get_document("value").ok().cloned())
}

async fn backfill_comment_review_model(database: &Database) -> Result<(), mongodb::error::Error> {
    let Some(ai_options) = option_value(database, "ai").await else {
        return Ok(());
    };
    let Some(assignment) = ai_options.get_document("commentReviewModel").ok() else {
        return Ok(());
    };
    if assignment.get_str("model").is_ok() {
        return Ok(());
    }
    let Some(provider_id) = assignment.get_str("providerId").ok() else {
        return Ok(());
    };
    let model = ai_options
        .get_array("providers")
        .ok()
        .and_then(|providers| {
            providers.iter().find_map(|provider| {
                let provider = provider.as_document()?;
                (provider.get_str("id").ok()? == provider_id)
                    .then(|| {
                        provider
                            .get_str("defaultModel")
                            .ok()
                            .map(ToString::to_string)
                    })
                    .flatten()
            })
        });
    if let Some(model) = model.filter(|model| !model.is_empty()) {
        database
            .collection::<Document>("options")
            .update_one(
                doc! { "name": "ai" },
                doc! { "$set": { "value.commentReviewModel.model": model } },
            )
            .await?;
    }
    Ok(())
}

/// 将旧环境变量迁移到 options 集合，并清除后端不再消费的历史配置。
pub async fn migrate_options(
    database: &Database,
    config: &AppConfig,
) -> Result<(), mongodb::error::Error> {
    let collection = database.collection::<Document>("options");
    collection
        .delete_many(doc! { "name": { "$in": UNUSED_OPTIONS } })
        .await?;
    collection
        .update_one(
            doc! { "name": "ai" },
            doc! { "$unset": {
                "value.writerModel": "",
                "value.enableAutoGenerateSummary": "",
                "value.enableAutoGenerateSummaryOnCreate": "",
                "value.enableAutoGenerateSummaryOnUpdate": "",
                "value.summaryTargetLanguages": "",
                "value.summaryMinTextLength": "",
                "value.enableAutoGenerateTranslation": "",
                "value.translationTargetLanguages": "",
            } },
        )
        .await?;
    backfill_comment_review_model(database).await?;
    collection
        .update_one(
            doc! { "name": "mailOptions" },
            doc! { "$unset": { "value.resend": "" } },
        )
        .await?;
    collection
        .update_one(
            doc! { "name": "url" },
            doc! { "$unset": { "value.adminUrl": "", "value.wsUrl": "" } },
        )
        .await?;

    ensure_field(database, "url", "webUrl", config.frontend_url.clone()).await?;
    ensure_field(database, "url", "serverUrl", config.backend_url.clone()).await?;
    ensure_field(
        database,
        "searchOptions",
        "endpoint",
        config.meilisearch_host.clone(),
    )
    .await?;
    ensure_field(
        database,
        "searchOptions",
        "apiKey",
        config.meilisearch_api_key.clone(),
    )
    .await?;
    ensure_field(
        database,
        "friendLinkOptions",
        "healthCheckIntervalHours",
        i64::try_from(config.link_health_interval_hours).unwrap_or(6),
    )
    .await?;
    ensure_field(
        database,
        "friendLinkOptions",
        "healthCheckTimeoutSeconds",
        i64::try_from(config.link_health_timeout_secs).unwrap_or(10),
    )
    .await?;

    if !config.turnstile_secret.is_empty() && config.turnstile_secret != "THISISTURNSTILEKEY" {
        ensure_field(
            database,
            "commentOptions",
            "turnstileSecret",
            config.turnstile_secret.clone(),
        )
        .await?;
    }
    if !config.github_client_id.is_empty() {
        ensure_field(
            database,
            "oauth",
            "public.github.clientId",
            config.github_client_id.clone(),
        )
        .await?;
    }
    if !config.github_client_secret.is_empty() {
        ensure_field(
            database,
            "oauth",
            "secrets.github.clientSecret",
            config.github_client_secret.clone(),
        )
        .await?;
    }
    if !config.qq_app_id.is_empty() {
        ensure_field(
            database,
            "oauth",
            "public.qq.appId",
            config.qq_app_id.clone(),
        )
        .await?;
    }
    if !config.qq_app_key.is_empty() {
        ensure_field(
            database,
            "oauth",
            "secrets.qq.appKey",
            config.qq_app_key.clone(),
        )
        .await?;
    }

    database
        .collection::<Document>("system_migrations")
        .update_one(
            doc! { "name": "options-form-v2" },
            doc! { "$setOnInsert": { "name": "options-form-v2", "appliedAt": bson::DateTime::now() } },
        )
        .upsert(true)
        .await?;
    Ok(())
}

/// 从数据库覆盖应用级配置；环境变量只作为首次迁移和缺失值回退。
pub async fn apply_database_options(database: &Database, config: &mut AppConfig) {
    if let Some(url) = option_value(database, "url").await {
        config.frontend_url =
            nested_string(&url, &["webUrl"]).unwrap_or(config.frontend_url.clone());
        config.backend_url =
            nested_string(&url, &["serverUrl"]).unwrap_or(config.backend_url.clone());
    }
    if let Some(search) = option_value(database, "searchOptions").await {
        config.meilisearch_host = nested_string(&search, &["endpoint"])
            .filter(|value| !value.is_empty())
            .unwrap_or(config.meilisearch_host.clone());
        config.meilisearch_api_key =
            nested_string(&search, &["apiKey"]).unwrap_or(config.meilisearch_api_key.clone());
    }
    if let Some(comment) = option_value(database, "commentOptions").await {
        config.comments_disabled =
            nested_bool(&comment, &["disableComment"]).unwrap_or(config.comments_disabled);
        config.comments_allow_no_chinese = nested_bool(&comment, &["disableNoChinese"])
            .unwrap_or(config.comments_allow_no_chinese);
        config.comments_require_audit =
            nested_bool(&comment, &["commentShouldAudit"]).unwrap_or(config.comments_require_audit);
        config.comments_record_ip_location = nested_bool(&comment, &["recordIpLocation"])
            .unwrap_or(config.comments_record_ip_location);
        config.comments_blocked_ips = nested_strings(&comment, &["blockIps"])
            .unwrap_or_else(|| config.comments_blocked_ips.clone());
        config.comments_spam_keywords = nested_strings(&comment, &["spamKeywords"])
            .unwrap_or_else(|| config.comments_spam_keywords.clone());
        config.turnstile_secret = nested_string(&comment, &["turnstileSecret"])
            .unwrap_or(config.turnstile_secret.clone());
    }
    if let Some(friend) = option_value(database, "friendLinkOptions").await {
        config.friend_link_allow_apply =
            nested_bool(&friend, &["allowApply"]).unwrap_or(config.friend_link_allow_apply);
        config.friend_link_allow_sub_path =
            nested_bool(&friend, &["allowSubPath"]).unwrap_or(config.friend_link_allow_sub_path);
        config.link_health_interval_hours = nested_u64(&friend, &["healthCheckIntervalHours"])
            .unwrap_or(config.link_health_interval_hours);
        config.link_health_timeout_secs = nested_u64(&friend, &["healthCheckTimeoutSeconds"])
            .unwrap_or(config.link_health_timeout_secs);
    }
    if let Some(oauth) = option_value(database, "oauth").await {
        config.github_client_id = nested_string(&oauth, &["public", "github", "clientId"])
            .unwrap_or(config.github_client_id.clone());
        config.github_client_secret = nested_string(&oauth, &["secrets", "github", "clientSecret"])
            .unwrap_or(config.github_client_secret.clone());
        config.qq_app_id =
            nested_string(&oauth, &["public", "qq", "appId"]).unwrap_or(config.qq_app_id.clone());
        config.qq_app_key = nested_string(&oauth, &["secrets", "qq", "appKey"])
            .unwrap_or(config.qq_app_key.clone());
    }
}
