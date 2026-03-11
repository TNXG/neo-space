//! Search service (Meilisearch)

use meilisearch_sdk::{client::Client, indexes::Index, search::Selectors};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::AppError;

/// Post document for Meilisearch
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PostDocument {
    pub id: String,
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

/// Search service wrapper for Meilisearch
#[derive(Clone)]
pub struct SearchService {
    client: Arc<Client>,
}

impl SearchService {
    /// Create a new search service
    pub fn new(url: String, api_key: Option<String>) -> Result<Self, AppError> {
        tracing::info!("Initializing Meilisearch client: {}", url);

        let client = match api_key {
            Some(key) => Client::new(url, Some(key)).map_err(|e| {
                AppError::Internal(format!("Failed to create Meilisearch client: {}", e))
            })?,
            None => Client::new(url, Option::<String>::None).map_err(|e| {
                AppError::Internal(format!("Failed to create Meilisearch client: {}", e))
            })?,
        };

        Ok(Self {
            client: Arc::new(client),
        })
    }

    /// Get posts index
    fn posts_index(&self) -> Index {
        self.client.index("posts")
    }

    /// Get notes index
    fn notes_index(&self) -> Index {
        self.client.index("notes")
    }

    /// Search posts with highlighting
    pub async fn search_posts(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<PostSearchHit>, AppError> {
        let index = self.posts_index();
        let mut search = index.search();
        search
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
            .with_attributes_to_highlight(Selectors::Some(&["title", "text"]))
            .with_attributes_to_crop(Selectors::Some(&[("text", Some(80))]))
            .with_highlight_pre_tag("<mark>")
            .with_highlight_post_tag("</mark>")
            .with_show_ranking_score(true);

        let results = search
            .execute::<PostDocument>()
            .await
            .map_err(|e| AppError::Internal(format!("Search posts failed: {}", e)))?;

        Ok(results
            .hits
            .into_iter()
            .map(|hit| PostSearchHit {
                formatted: extract_formatted_strings(hit.formatted_result),
                score: hit.ranking_score.unwrap_or(0.0),
                doc: hit.result,
            })
            .collect())
    }

    /// Search notes with highlighting
    pub async fn search_notes(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
    ) -> Result<Vec<NoteSearchHit>, AppError> {
        let index = self.notes_index();
        let mut search = index.search();
        search
            .with_query(query)
            .with_limit(limit)
            .with_offset(offset)
            .with_attributes_to_highlight(Selectors::Some(&["title", "text"]))
            .with_attributes_to_crop(Selectors::Some(&[("text", Some(80))]))
            .with_highlight_pre_tag("<mark>")
            .with_highlight_post_tag("</mark>")
            .with_show_ranking_score(true);

        let results = search
            .execute::<NoteDocument>()
            .await
            .map_err(|e| AppError::Internal(format!("Search notes failed: {}", e)))?;

        Ok(results
            .hits
            .into_iter()
            .map(|hit| NoteSearchHit {
                formatted: extract_formatted_strings(hit.formatted_result),
                score: hit.ranking_score.unwrap_or(0.0),
                doc: hit.result,
            })
            .collect())
    }
}

// Types are already defined above and automatically exported via pub
