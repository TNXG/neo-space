//! Search service (Meilisearch)

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

use crate::error::AppError;

/// Post document for Meilisearch
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostDocument {
    pub id: String,
    pub ref_id: String,
    pub lang: String,
    pub title: String,
    pub text: String,
    pub slug: String,
    pub category: Option<String>,
    pub category_name: Option<String>,
    pub tags: Vec<String>,
    pub created: i64,
}

/// Note document for Meilisearch
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteDocument {
    pub id: String,
    pub ref_id: String,
    pub lang: String,
    pub title: String,
    pub text: String,
    pub nid: i32,
    pub created: i64,
}

/// Post search hit with highlighting
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostSearchHit {
    pub doc: PostDocument,
    pub formatted: HashMap<String, String>,
    pub score: f64,
}

/// Note search hit with highlighting
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteSearchHit {
    pub doc: NoteDocument,
    pub formatted: HashMap<String, String>,
    pub score: f64,
}

/// Extract formatted strings from Meilisearch response
fn extract_formatted_strings(
    map: Option<serde_json::Map<String, Value>>,
) -> HashMap<String, String> {
    let mut result = HashMap::new();
    if let Some(m) = map {
        for (k, v) in m {
            if let Value::String(s) = v {
                result.insert(k, s);
            }
        }
    }
    result
}

/// Search and indexing use the same explicit transport as all other backend integrations.
#[derive(Clone)]
pub struct SearchService {
    client: crate::external::meilisearch_admin::MeilisearchAdminClient,
}

impl SearchService {
    pub fn new(state: &crate::app::SharedState) -> Self {
        Self {
            client: crate::external::meilisearch_admin::MeilisearchAdminClient::from_state(state),
        }
    }

    // Generic serialized bodies are only used by locally awaited requests.
    #[allow(clippy::future_not_send)]
    async fn enqueue(&self, path: &str, body: &impl Serialize) -> Result<(), AppError> {
        let task = self
            .client
            .request_json(reqwest::Method::POST, path, body)
            .await?;
        let uid = task
            .get("taskUid")
            .and_then(Value::as_u64)
            .ok_or_else(|| AppError::Internal("Meilisearch omitted taskUid".into()))?;
        self.client.wait_for_task(uid).await?;
        Ok(())
    }

    /// Bulk indexing preserves the existing primary key and waits for task completion.
    pub async fn index_posts(&self, docs: Vec<PostDocument>) -> Result<(), AppError> {
        if !docs.is_empty() {
            self.enqueue("/indexes/posts/documents?primaryKey=id", &docs)
                .await?;
        }
        Ok(())
    }

    pub async fn index_notes(&self, docs: Vec<NoteDocument>) -> Result<(), AppError> {
        if !docs.is_empty() {
            self.enqueue("/indexes/notes/documents?primaryKey=id", &docs)
                .await?;
        }
        Ok(())
    }

    pub async fn delete_post_documents_by_ref(&self, ref_id: &str) -> Result<(), AppError> {
        self.delete_documents_by_ref("posts", ref_id).await
    }

    pub async fn delete_note_documents_by_ref(&self, ref_id: &str) -> Result<(), AppError> {
        self.delete_documents_by_ref("notes", ref_id).await
    }

    async fn delete_documents_by_ref(&self, index: &str, ref_id: &str) -> Result<(), AppError> {
        self.enqueue(&format!("/indexes/{index}/documents/delete"),
            &serde_json::json!({ "filter": format!("ref_id = \"{}\"", ref_id.replace('"', "\\\"")) })).await
    }

    async fn search(
        &self,
        index: &str,
        query: &str,
        limit: usize,
        offset: usize,
        lang: &str,
    ) -> Result<Vec<Value>, AppError> {
        let result = self.client.request_json(reqwest::Method::POST, &format!("/indexes/{index}/search"), &serde_json::json!({
            "q": query, "limit": limit, "offset": offset,
            "filter": format!("lang = \"{}\"", lang.replace('"', "\\\"")),
            "attributesToHighlight": ["title", "text"], "attributesToCrop": ["text:80"],
            "highlightPreTag": "<mark>", "highlightPostTag": "</mark>", "showRankingScore": true,
        })).await?;
        result
            .get("hits")
            .and_then(Value::as_array)
            .cloned()
            .ok_or_else(|| AppError::Internal("Meilisearch omitted search hits".into()))
    }

    pub async fn search_posts(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
        lang: &str,
    ) -> Result<Vec<PostSearchHit>, AppError> {
        self.search("posts", query, limit, offset, lang)
            .await?
            .into_iter()
            .map(|hit| {
                let formatted = extract_formatted_strings(
                    hit.get("_formatted").and_then(Value::as_object).cloned(),
                );
                let score = hit
                    .get("_rankingScore")
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0);
                let doc = serde_json::from_value(hit)
                    .map_err(|_| AppError::Internal("Invalid Meilisearch post hit".into()))?;
                Ok(PostSearchHit {
                    doc,
                    formatted,
                    score,
                })
            })
            .collect()
    }

    pub async fn search_notes(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
        lang: &str,
    ) -> Result<Vec<NoteSearchHit>, AppError> {
        self.search("notes", query, limit, offset, lang)
            .await?
            .into_iter()
            .map(|hit| {
                let formatted = extract_formatted_strings(
                    hit.get("_formatted").and_then(Value::as_object).cloned(),
                );
                let score = hit
                    .get("_rankingScore")
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0);
                let doc = serde_json::from_value(hit)
                    .map_err(|_| AppError::Internal("Invalid Meilisearch note hit".into()))?;
                Ok(NoteSearchHit {
                    doc,
                    formatted,
                    score,
                })
            })
            .collect()
    }
}

#[cfg(test)]
#[path = "../../tests/unit/search_transport.rs"]
mod tests;
