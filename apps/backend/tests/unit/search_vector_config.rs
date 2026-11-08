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
