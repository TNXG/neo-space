//! AI service - OpenAI-compatible chat completions
//!
//! Reads AI configuration from the database (options collection, name="ai")
//! and calls any OpenAI-compatible API endpoint.

use mongodb::Database;
use mongodb::bson::doc;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::models::options::RawOption;

/// AI configuration read from the database
#[derive(Debug, Clone)]
pub struct AiConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub model: String,
    pub api_key: String,
}

/// Raw shape of the "ai" option stored in MongoDB
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiOptionsValue {
    #[serde(default)]
    enable_summary: bool,
    #[serde(default)]
    open_ai_endpoint: String,
    #[serde(default)]
    open_ai_preferred_model: String,
    #[serde(default)]
    open_ai_key: String,
}

/// Chat message role
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
}

/// A single chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

// ── Internal request/response shapes ──────────────────────────────────────────

#[derive(Debug, Serialize)]
struct OpenAIRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAIMessage {
    content: Option<String>,
}

// ── Public API ─────────────────────────────────────────────────────────────────

/// Load AI configuration from the database
pub async fn get_ai_config(db: &Database) -> Result<AiConfig, String> {
    let collection = db.collection::<RawOption>("options");

    let option = collection
        .find_one(doc! { "name": "ai" })
        .await
        .map_err(|e| format!("Database error: {e}"))?
        .ok_or_else(|| "AI configuration not found".to_string())?;

    let doc = option
        .value
        .as_document()
        .ok_or_else(|| "AI options value is not a document".to_string())?;

    let ai_options: AiOptionsValue =
        bson::from_document(doc.clone()).map_err(|e| format!("Failed to parse AI options: {e}"))?;

    Ok(AiConfig {
        enabled: ai_options.enable_summary,
        endpoint: ai_options.open_ai_endpoint,
        model: ai_options.open_ai_preferred_model,
        api_key: ai_options.open_ai_key,
    })
}

/// OpenAI-compatible AI service
pub struct AiService {
    config: AiConfig,
    client: Client,
}

impl AiService {
    /// Create from an existing config and HTTP client
    pub fn new(config: AiConfig, client: Client) -> Self {
        Self { config, client }
    }

    /// Create by fetching configuration from the database
    pub async fn from_database(db: &Database, client: Client) -> Result<Self, String> {
        let config = get_ai_config(db).await?;
        Ok(Self::new(config, client))
    }

    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Send a chat completion request and return the response text.
    pub async fn chat(
        &self,
        messages: &[ChatMessage],
        temperature: Option<f32>,
        max_tokens: Option<u32>,
    ) -> Result<String, String> {
        if !self.config.enabled {
            return Err("AI service is disabled".to_string());
        }

        let endpoint = format!(
            "{}/chat/completions",
            self.config.endpoint.trim_end_matches('/')
        );

        let body = OpenAIRequest {
            model: &self.config.model,
            messages,
            temperature,
            max_tokens,
        };

        let response = self
            .client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("API request failed: {e}"))?;

        let result: OpenAIResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse AI response: {e}"))?;

        result
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .ok_or_else(|| "No response content returned by AI".to_string())
    }
}
