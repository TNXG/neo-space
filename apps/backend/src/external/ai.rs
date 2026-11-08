//! AI service - OpenAI-compatible chat completions
//!
//! Reads AI configuration from the database (options collection, name="ai")
//! and calls any OpenAI-compatible API endpoint.

mod validation;
pub use validation::validate_ai_options;

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
    pub provider_type: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AiUsage {
    /// Time-capsule analysis uses the existing summaryModel / enableSummary settings.
    Summary,
    Translation,
    CommentReview,
}

/// Raw shape of the "ai" option stored in MongoDB
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiOptionsValue {
    #[serde(default)]
    providers: Vec<AiProvider>,
    #[serde(default)]
    summary_model: Option<AiModelSelection>,
    #[serde(default)]
    translation_model: Option<AiModelSelection>,
    #[serde(default)]
    comment_review_model: Option<AiModelSelection>,
    #[serde(default)]
    enable_summary: bool,
    #[serde(default)]
    enable_translation: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiProvider {
    id: String,
    #[serde(rename = "type", default)]
    provider_type: String,
    #[serde(default)]
    api_key: String,
    #[serde(default)]
    endpoint: String,
    #[serde(default)]
    default_model: String,
    #[serde(default)]
    enabled: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AiModelSelection {
    provider_id: String,
    #[serde(default)]
    model: Option<String>,
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

fn get_selected_provider_id(ai_options: &AiOptionsValue, usage: AiUsage) -> Option<&str> {
    match usage {
        AiUsage::Summary => ai_options
            .summary_model
            .as_ref()
            .map(|model| model.provider_id.as_str()),
        AiUsage::Translation => ai_options
            .translation_model
            .as_ref()
            .map(|model| model.provider_id.as_str()),
        AiUsage::CommentReview => ai_options
            .comment_review_model
            .as_ref()
            .map(|model| model.provider_id.as_str()),
    }
}

// Preserve the owned configuration boundary shared with validation.
#[allow(clippy::needless_pass_by_value)]
fn to_ai_config(ai_options: AiOptionsValue, usage: AiUsage) -> Result<AiConfig, String> {
    if ai_options.providers.is_empty() {
        return Err(
            "AI provider is not configured; add a provider and assign models in AI settings"
                .to_string(),
        );
    }

    let selected_provider_id = get_selected_provider_id(&ai_options, usage);
    if usage == AiUsage::CommentReview && selected_provider_id.is_none() {
        return Err("Comment review provider and model are not configured".to_string());
    }
    let selected_model = match usage {
        AiUsage::Summary => ai_options.summary_model.as_ref(),
        AiUsage::Translation => ai_options.translation_model.as_ref(),
        AiUsage::CommentReview => ai_options.comment_review_model.as_ref(),
    };
    let provider = selected_provider_id
        .and_then(|provider_id| {
            ai_options
                .providers
                .iter()
                .find(|provider| provider.id == provider_id)
        })
        .or_else(|| {
            (usage != AiUsage::CommentReview)
                .then(|| {
                    ai_options
                        .providers
                        .iter()
                        .find(|provider| provider.enabled)
                })
                .flatten()
        })
        .ok_or_else(|| "No enabled AI provider found".to_string())?;

    match provider.provider_type.as_str() {
        "openai" | "openai-compatible" => {}
        "jev" if usage == AiUsage::CommentReview => {}
        other => {
            return Err(format!(
                "Unsupported AI provider type for {usage:?}: {other}"
            ));
        }
    }
    if usage == AiUsage::CommentReview
        && (provider.api_key.trim().is_empty() || provider.endpoint.trim().is_empty())
    {
        return Err("Comment review provider endpoint and API key are required".into());
    }

    let model = selected_model
        .and_then(|selection| selection.model.clone())
        .filter(|model| !model.is_empty())
        .unwrap_or_else(|| provider.default_model.clone());
    if usage == AiUsage::CommentReview && model.is_empty() {
        return Err("Comment review model is not configured".to_string());
    }

    Ok(AiConfig {
        enabled: provider.enabled
            && match usage {
                AiUsage::Summary => ai_options.enable_summary,
                AiUsage::Translation => ai_options.enable_translation,
                AiUsage::CommentReview => true,
            },
        endpoint: provider.endpoint.clone(),
        model,
        api_key: provider.api_key.clone(),
        provider_type: provider.provider_type.clone(),
    })
}

/// Load AI configuration from the database
pub async fn get_ai_config_for_usage(db: &Database, usage: AiUsage) -> Result<AiConfig, String> {
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

    to_ai_config(ai_options, usage)
}

/// OpenAI-compatible AI service
pub struct AiService {
    config: AiConfig,
    client: Client,
}

impl AiService {
    /// Create from an existing config and HTTP client
    pub const fn new(config: AiConfig, client: Client) -> Self {
        Self { config, client }
    }

    /// Create by fetching configuration from the database for a specific usage
    pub async fn from_database_for_usage(
        db: &Database,
        client: Client,
        usage: AiUsage,
    ) -> Result<Self, String> {
        let config = get_ai_config_for_usage(db, usage).await?;
        Ok(Self::new(config, client))
    }

    pub const fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// Jev is a structured classifier and cannot be used as a chat model.
    pub fn is_jev(&self) -> bool {
        self.config.provider_type == "jev"
    }

    /// Return Jev's probability that this comment is spam.
    pub async fn spam_probability(
        &self,
        text: &str,
        author: &str,
        email: &str,
    ) -> Result<f32, String> {
        if !self.is_enabled() || !self.is_jev() {
            return Err("An enabled Jev provider is required".into());
        }
        super::jev::spam_probability(
            &self.client,
            &self.config.endpoint,
            &self.config.api_key,
            &self.config.model,
            text,
            author,
            email,
        )
        .await
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
        if self.is_jev() {
            return Err("Jev only supports structured comment-review decisions".into());
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
        let response = response
            .error_for_status()
            .map_err(|error| format!("AI HTTP failure: {error}"))?;

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

#[cfg(test)]
#[path = "../../tests/unit/ai.rs"]
mod tests;
