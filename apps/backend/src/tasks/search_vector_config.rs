//! 项目级 Meilisearch 向量策略的持久化与索引同步。

use bson::{Document, doc};
use mongodb::Database;
use reqwest::Method;
use serde_json::{Map, Value, json};

use crate::{
    error::{AppError, AppResult},
    external::meilisearch_admin::MeilisearchAdminClient,
    models::SearchVectorConfig,
};

const OPTION_NAME: &str = "searchVector";
const EMBEDDER_NAME: &str = "default";

/// 从项目配置集合读取向量策略。
pub async fn load_vector_config(database: &Database) -> AppResult<SearchVectorConfig> {
    let document = database
        .collection::<Document>("options")
        .find_one(doc! { "name": OPTION_NAME })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let Some(value) = document.and_then(|document| document.get("value").cloned()) else {
        return Ok(SearchVectorConfig::default());
    };
    bson::from_bson(value).map_err(|error| AppError::Internal(format!("解析向量配置失败: {error}")))
}

/// 优先读取项目配置；首次升级时从现有正式索引迁移 REST Embedder 公共参数。
pub async fn load_or_infer_vector_config(
    database: &Database,
    client: &MeilisearchAdminClient,
) -> AppResult<SearchVectorConfig> {
    let config = load_vector_config(database).await?;
    if config.configured {
        return Ok(config);
    }
    let indexes = client.list_all_indexes().await?;
    for uid in indexes
        .iter()
        .filter_map(|index| index.get("uid").and_then(Value::as_str))
        .filter(|uid| !is_rebuild_index(uid))
    {
        let settings = client
            .request(Method::GET, &format!("/indexes/{uid}/settings"))
            .await?;
        if let Some(config) = infer_config(&settings) {
            save_vector_config(database, &config).await?;
            tracing::info!(index_uid = uid, "已从现有索引迁移项目级向量配置");
            return Ok(config);
        }
    }
    Ok(config)
}

/// 保存项目级向量策略。
pub async fn save_vector_config(database: &Database, config: &SearchVectorConfig) -> AppResult<()> {
    let value = bson::to_bson(config)
        .map_err(|error| AppError::Internal(format!("编码向量配置失败: {error}")))?;
    database
        .collection::<Document>("options")
        .update_one(
            doc! { "name": OPTION_NAME },
            doc! { "$set": { "name": OPTION_NAME, "value": value } },
        )
        .upsert(true)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    Ok(())
}

/// 将项目级向量策略同步到当前全部正式索引。
pub async fn apply_vector_config_to_all_indexes(
    client: &MeilisearchAdminClient,
    config: &SearchVectorConfig,
) -> AppResult<usize> {
    let indexes = client.list_all_indexes().await?;
    let index_uids = indexes
        .iter()
        .filter_map(|index| index.get("uid").and_then(Value::as_str))
        .filter(|uid| !is_rebuild_index(uid))
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    for uid in &index_uids {
        enqueue_vector_config_to_index(client, uid, config).await?;
    }
    Ok(index_uids.len())
}

/// 将项目级向量策略任务提交到一个索引，不等待可能耗时很长的重新向量化。
async fn enqueue_vector_config_to_index(
    client: &MeilisearchAdminClient,
    uid: &str,
    config: &SearchVectorConfig,
) -> AppResult<()> {
    let current = client
        .request(Method::GET, &format!("/indexes/{uid}/settings"))
        .await?;
    let embedders = build_embedders(&current, config);
    if vector_config_matches(&current, &embedders, config) {
        return Ok(());
    }
    client
        .request_json(
            Method::PATCH,
            &format!("/indexes/{uid}/settings"),
            &json!({ "embedders": embedders }),
        )
        .await?;
    Ok(())
}

/// 将项目级向量策略应用到一个索引，并保留该索引的文档模板。
pub async fn apply_vector_config_to_index(
    client: &MeilisearchAdminClient,
    uid: &str,
    config: &SearchVectorConfig,
) -> AppResult<()> {
    let current = client
        .request(Method::GET, &format!("/indexes/{uid}/settings"))
        .await?;
    let embedders = build_embedders(&current, config);
    if vector_config_matches(&current, &embedders, config) {
        return Ok(());
    }
    client
        .request_task(
            Method::PATCH,
            &format!("/indexes/{uid}/settings"),
            &json!({ "embedders": embedders }),
        )
        .await?;
    Ok(())
}

/// 判断索引当前 Embedder 是否已经符合项目策略。
fn vector_config_matches(current: &Value, embedders: &Value, config: &SearchVectorConfig) -> bool {
    (config.configured
        && !config.enabled
        && current
            .get("embedders")
            .and_then(Value::as_object)
            .is_some_and(Map::is_empty))
        || current.get("embedders") == Some(embedders)
}

/// 把项目级向量策略合并进即将写入新索引的完整设置。
pub fn merge_vector_config_into_settings(settings: &mut Value, config: &SearchVectorConfig) {
    let embedders = build_embedders(settings, config);
    if let Some(settings) = settings.as_object_mut() {
        settings.insert("embedders".to_string(), embedders);
    }
}

/// 判断索引是否为蓝绿重建的临时索引。
pub fn is_rebuild_index(uid: &str) -> bool {
    uid.rsplit_once("__rebuild_")
        .is_some_and(|(source, suffix)| {
            !source.is_empty()
                && suffix.len() == 24
                && suffix
                    .chars()
                    .all(|character| character.is_ascii_hexdigit())
        })
}

/// 构建 Meilisearch REST Embedder，并继承索引自己的文档模板。
fn build_embedders(settings: &Value, config: &SearchVectorConfig) -> Value {
    if !config.configured {
        return settings
            .get("embedders")
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));
    }
    if !config.enabled {
        return Value::Null;
    }
    let existing = settings
        .get("embedders")
        .and_then(|embedders| embedders.get(EMBEDDER_NAME));
    let document_template = existing
        .and_then(|embedder| embedder.get("documentTemplate"))
        .cloned();
    let mut embedder = json!({
        "source": "rest",
        "url": config.api_url,
        "dimensions": config.dimensions,
        "documentTemplateMaxBytes": config.document_template_max_bytes,
        "request": {
            "model": config.model,
            "input": ["{{text}}", "{{..}}"]
        },
        "response": {
            "data": [{ "embedding": "{{embedding}}" }, "{{..}}"]
        },
        "headers": {}
    });
    if let Some(embedder) = embedder.as_object_mut() {
        if !config.api_key.is_empty() {
            embedder.insert(
                "headers".to_string(),
                json!({ "Authorization": format!("Bearer {}", config.api_key) }),
            );
        }
        if let Some(document_template) = document_template {
            embedder.insert("documentTemplate".to_string(), document_template);
        }
    }
    json!({ EMBEDDER_NAME: embedder })
}

/// 从 Meilisearch REST Embedder 设置提取项目级公共参数。
fn infer_config(settings: &Value) -> Option<SearchVectorConfig> {
    let embedder = settings.get("embedders")?.get(EMBEDDER_NAME)?;
    if embedder.get("source")?.as_str()? != "rest" {
        return None;
    }
    let api_key = embedder
        .get("headers")
        .and_then(|headers| headers.get("Authorization"))
        .and_then(Value::as_str)
        .and_then(|authorization| authorization.strip_prefix("Bearer "))
        .unwrap_or_default()
        .to_string();
    Some(SearchVectorConfig {
        configured: true,
        enabled: true,
        api_url: embedder.get("url")?.as_str()?.to_string(),
        api_key,
        model: embedder.get("request")?.get("model")?.as_str()?.to_string(),
        dimensions: u32::try_from(embedder.get("dimensions")?.as_u64()?).ok()?,
        document_template_max_bytes: embedder
            .get("documentTemplateMaxBytes")
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok())
            .unwrap_or(400),
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::models::SearchVectorConfig;

    use super::{build_embedders, infer_config, is_rebuild_index};

    /// 验证项目公共参数会覆盖索引 Embedder，同时保留文档模板。
    #[test]
    fn builds_global_embedder_and_preserves_document_template() {
        let settings = json!({
            "embedders": {
                "default": { "documentTemplate": "title: {{doc.title}}" }
            }
        });
        let config = SearchVectorConfig {
            configured: true,
            enabled: true,
            api_url: "https://example.com/v1/embeddings".to_string(),
            api_key: "secret".to_string(),
            model: "embedding-model".to_string(),
            dimensions: 1536,
            document_template_max_bytes: 800,
        };

        let embedders = build_embedders(&settings, &config);
        let embedder = embedders.get("default").and_then(|value| value.as_object());

        assert_eq!(
            embedder
                .and_then(|value| value.get("documentTemplate"))
                .and_then(|value| value.as_str()),
            Some("title: {{doc.title}}")
        );
        assert_eq!(
            embedder
                .and_then(|value| value.get("headers"))
                .and_then(|value| value.get("Authorization"))
                .and_then(|value| value.as_str()),
            Some("Bearer secret")
        );
    }

    /// 验证旧索引的 REST Embedder 可以迁移为项目配置。
    #[test]
    fn infers_project_config_from_existing_embedder() {
        let settings = json!({
            "embedders": {
                "default": {
                    "source": "rest",
                    "url": "https://example.com/v1/embeddings",
                    "dimensions": 1024,
                    "documentTemplateMaxBytes": 400,
                    "request": { "model": "embedding-model" },
                    "headers": { "Authorization": "Bearer secret" }
                }
            }
        });

        let config = infer_config(&settings);

        assert_eq!(config.as_ref().map(|config| config.configured), Some(true));
        assert_eq!(
            config.as_ref().map(|config| config.api_key.as_str()),
            Some("secret")
        );
        assert_eq!(config.as_ref().map(|config| config.dimensions), Some(1024));
    }

    /// 验证只有带重建标记的索引会被排除和清理。
    #[test]
    fn identifies_rebuild_indexes() {
        assert!(is_rebuild_index("posts__rebuild_507f1f77bcf86cd799439011"));
        assert!(!is_rebuild_index("posts"));
        assert!(!is_rebuild_index("customer__rebuild_archive"));
    }
}
