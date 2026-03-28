//! Meilisearch synchronization utilities

use crate::app::SharedState;
use crate::external::search::{NoteDocument, PostDocument, SearchService};
use crate::models::{Category, Note, Post};
use mongodb::bson::Document;

/// Sync post to Meilisearch
pub(crate) async fn sync_post_to_meilisearch(
    state: &SharedState,
    doc: &Option<Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let doc = doc.as_ref().ok_or("Missing document")?;

    // Extract post data
    let id = doc.get_object_id("_id")?.to_hex();
    let title = doc.get_str("title")?;
    let text = doc.get_str("text")?;
    let slug = doc.get_str("slug")?;

    let category_id = doc.get_object_id("categoryId").ok().map(|id| id.to_hex());

    let tags: Vec<String> = doc
        .get_array("tags")
        .ok()
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();

    let created = doc
        .get_datetime("created")
        .ok()
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(0);

    // Build Meilisearch document
    let search_doc = serde_json::json!({
        "id": id,
        "title": title,
        "text": text,
        "slug": slug,
        "category": category_id,
        "category_name": Option::<String>::None,  // Would need to fetch from category collection
        "tags": tags,
        "created": created,
    });

    // Send to Meilisearch
    if let Err(e) = meilisearch_index_document(&state.http_client, "posts", &id, &search_doc).await
    {
        tracing::error!("Failed to index post {} to Meilisearch: {}", id, e);
    }

    Ok(())
}

/// Sync note to Meilisearch
pub(crate) async fn sync_note_to_meilisearch(
    state: &SharedState,
    doc: &Option<Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let doc = doc.as_ref().ok_or("Missing document")?;

    let id = doc.get_object_id("_id")?.to_hex();
    let title = doc.get_str("title")?;
    let text = doc.get_str("text")?;
    let nid = doc.get_i32("nid")?;

    let created = doc
        .get_datetime("created")
        .ok()
        .map(|dt| dt.timestamp_millis())
        .unwrap_or(0);

    let search_doc = serde_json::json!({
        "id": id,
        "title": title,
        "text": text,
        "nid": nid,
        "created": created,
    });

    if let Err(e) = meilisearch_index_document(&state.http_client, "notes", &id, &search_doc).await
    {
        tracing::error!("Failed to index note {} to Meilisearch: {}", id, e);
    }

    Ok(())
}

/// Index document in Meilisearch
pub(crate) async fn meilisearch_index_document(
    client: &reqwest::Client,
    index: &str,
    id: &str,
    doc: &serde_json::Value,
) -> Result<(), Box<dyn std::error::Error>> {
    let host = std::env::var("MEILISEARCH_URL")
        .or_else(|_| std::env::var("MEILISEARCH_HOST"))
        .unwrap_or_else(|_| "http://localhost:7700".to_string());
    let api_key = std::env::var("MEILISEARCH_API_KEY").ok();

    let url = format!("{}/indexes/{}/documents", host, index);
    let mut request = client.post(&url).json(&[doc]);

    if let Some(key) = api_key {
        request = request.header("Authorization", format!("Bearer {}", key));
    }

    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Meilisearch error: {} - {}", status, body).into());
    }

    tracing::debug!("Indexed document {} in {}", id, index);
    Ok(())
}

/// Full sync: query all published posts and notes from MongoDB, bulk-index into Meilisearch.
/// Should be called once at startup.
pub async fn full_sync(state: SharedState) {
    tracing::info!("开始 Meilisearch 全量同步...");

    let api_key = if state.config.meilisearch_api_key.is_empty() {
        None
    } else {
        Some(state.config.meilisearch_api_key.clone())
    };

    let search_service = match SearchService::new(state.config.meilisearch_host.clone(), api_key) {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("全量同步: 创建 SearchService 失败: {:?}", e);
            return;
        }
    };

    // Initialize indexes (create + configure attributes)
    if let Err(e) = search_service.init_indexes().await {
        tracing::error!("全量同步: 初始化索引失败: {:?}", e);
        return;
    }

    // --- Sync posts ---
    sync_posts(&state, &search_service).await;

    // --- Sync notes ---
    sync_notes(&state, &search_service).await;

    tracing::info!("Meilisearch 全量同步完成");
}

async fn sync_posts(state: &SharedState, search_service: &SearchService) {
    use futures::TryStreamExt;
    use mongodb::bson::doc;

    let posts_col = state.db.collection::<Post>("posts");
    let categories_col = state.db.collection::<Category>("categories");

    let filter = doc! { "isPublished": true };
    let cursor = match posts_col.find(filter).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("全量同步: 查询文章失败: {}", e);
            return;
        }
    };

    let posts: Vec<Post> = match cursor.try_collect().await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("全量同步: 读取文章失败: {}", e);
            return;
        }
    };

    let mut docs = Vec::with_capacity(posts.len());
    for post in posts {
        // Look up category
        let category = categories_col
            .find_one(doc! { "_id": post.category_id })
            .await
            .ok()
            .flatten();

        docs.push(PostDocument {
            id: post.id.to_hex(),
            title: post.title,
            text: post.text,
            slug: post.slug,
            category: category.as_ref().map(|c| c.slug.clone()),
            category_name: category.map(|c| c.name),
            tags: post.tags,
            created: post.created.timestamp_millis() / 1000,
        });
    }

    let count = docs.len();
    if let Err(e) = search_service.index_posts(docs).await {
        tracing::error!("全量同步: 同步文章到 Meilisearch 失败: {:?}", e);
    } else {
        tracing::info!("已同步 {} 篇文章到 Meilisearch", count);
    }
}

async fn sync_notes(state: &SharedState, search_service: &SearchService) {
    use futures::TryStreamExt;
    use mongodb::bson::doc;

    let notes_col = state.db.collection::<Note>("notes");

    let filter = doc! { "isPublished": true };
    let cursor = match notes_col.find(filter).await {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("全量同步: 查询笔记失败: {}", e);
            return;
        }
    };

    let notes: Vec<Note> = match cursor.try_collect().await {
        Ok(n) => n,
        Err(e) => {
            tracing::error!("全量同步: 读取笔记失败: {}", e);
            return;
        }
    };

    let docs: Vec<NoteDocument> = notes
        .into_iter()
        .map(|note| NoteDocument {
            id: note.id.to_hex(),
            title: note.title,
            text: note.text,
            nid: note.nid,
            created: note.created.timestamp_millis() / 1000,
        })
        .collect();

    let count = docs.len();
    if let Err(e) = search_service.index_notes(docs).await {
        tracing::error!("全量同步: 同步笔记到 Meilisearch 失败: {:?}", e);
    } else {
        tracing::info!("已同步 {} 篇笔记到 Meilisearch", count);
    }
}
