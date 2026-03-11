//! Meilisearch synchronization utilities

use crate::app::SharedState;
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
    let host =
        std::env::var("MEILISEARCH_HOST").unwrap_or_else(|_| "http://localhost:7700".to_string());
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
