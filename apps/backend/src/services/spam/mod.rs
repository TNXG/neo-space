//! AI spam detection, sharing the saved AI comment-review assignment.

mod moderation;
mod parser;
mod prompts;
#[cfg(test)]
#[path = "../../../tests/unit/spam.rs"]
mod tests;

use mongodb::{Database, bson::doc};
use serde::Deserialize;

use crate::app::SharedState;
use crate::external::ai::{AiService, AiUsage, get_ai_config_for_usage};
use crate::models::{Comment, CommentState};
use crate::models::options::RawOption;

use self::parser::{parse_binary_response, parse_score_response};
use self::prompts::{build_binary_messages, build_score_messages};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommentOptions {
    #[serde(default)]
    anti_spam: bool,
    #[serde(default)]
    ai_review: bool,
    #[serde(default = "default_ai_review_type")]
    ai_review_type: String,
    #[serde(default = "default_ai_review_threshold")]
    ai_review_threshold: u8,
}

fn default_ai_review_type() -> String { "binary".to_string() }
fn default_ai_review_threshold() -> u8 { 5 }

impl CommentOptions {
    fn validate(&self) -> Result<(), String> {
        if !matches!(self.ai_review_type.as_str(), "binary" | "score") {
            return Err("AI review type must be binary or score".into());
        }
        if !(1..=10).contains(&self.ai_review_threshold) {
            return Err("AI review threshold must be between 1 and 10".into());
        }
        Ok(())
    }
}

/// Validate enabling comment review against the saved shared AI assignment.
pub async fn validate_comment_review_options(db: &Database, value: &bson::Bson) -> Result<(), String> {
    let options: CommentOptions = bson::from_bson(value.clone())
        .map_err(|error| format!("Invalid comment options: {error}"))?;
    if options.anti_spam && options.ai_review {
        options.validate()?;
        let config = get_ai_config_for_usage(db, AiUsage::CommentReview).await?;
        if !config.enabled {
            return Err("Enable the selected AI comment-review provider first".into());
        }
    }
    Ok(())
}

/// A completed classification. Errors and disabled checks never produce this value.
#[derive(Debug)]
pub struct SpamCheckResult {
    pub is_spam: bool,
    pub confidence: f32,
    pub reason: Option<String>,
}

/// Spam detection service.
pub struct SpamDetector;

impl SpamDetector {
    /// Review only the original submission; never approve or overwrite manual moderation.
    pub async fn review_async(state: SharedState, comment: Comment) {
        let Some(id) = comment.id else { return };
        if !matches!(comment.state, CommentState::UNREAD | CommentState::PENDING) {
            return;
        }
        match Self::check(&state.db, state.http_client.clone(), &comment.text, &comment.author, &comment.mail).await {
            Ok(Some(result)) => {
                tracing::info!(%id, is_spam = result.is_spam, confidence = result.confidence, reason = ?result.reason, "AI comment review completed");
                if let Err(error) = moderation::apply(&state, id, &comment, &result).await {
                    tracing::error!(%id, %error, "Failed to apply AI moderation");
                }
            }
            Ok(None) => tracing::debug!(%id, "AI comment review skipped; state unchanged"),
            Err(error) => tracing::warn!(%id, %error, "AI comment review failed; state unchanged"),
        }
    }

    /// `None` means deliberately skipped; `Err` means unavailable, not a clean result.
    pub async fn check(
        db: &Database,
        http_client: reqwest::Client,
        text: &str,
        author: &str,
        email: &str,
    ) -> Result<Option<SpamCheckResult>, String> {
        let options = Self::get_comment_options(db).await?;
        if !options.anti_spam || !options.ai_review {
            return Ok(None);
        }
        options.validate()?;
        let ai_service = AiService::from_database_for_usage(db, http_client, AiUsage::CommentReview).await?;
        if !ai_service.is_enabled() {
            return Err("AI comment-review provider is disabled".into());
        }
        let result = if ai_service.is_jev() {
            let probability = ai_service.spam_probability(text, author, email).await?;
            let threshold = if options.ai_review_type == "binary" { 0.5 } else { f32::from(options.ai_review_threshold) / 10.0 };
            SpamCheckResult {
                is_spam: probability >= threshold,
                confidence: probability,
                reason: Some(format!("Jev spam probability: {probability:.4}")),
            }
        } else if options.ai_review_type == "binary" {
            let messages = build_binary_messages(text, author, email);
            let response = ai_service.chat(&messages, Some(0.3), None).await?;
            parse_binary_response(&response)?
        } else {
            let messages = build_score_messages(text, author, email, options.ai_review_threshold);
            let response = ai_service.chat(&messages, Some(0.3), None).await?;
            parse_score_response(&response, options.ai_review_threshold)?
        };
        Ok(Some(result))
    }

    async fn get_comment_options(db: &Database) -> Result<CommentOptions, String> {
        let option = db.collection::<RawOption>("options")
            .find_one(doc! { "name": "commentOptions" }).await
            .map_err(|error| format!("Database error: {error}"))?
            .ok_or_else(|| "commentOptions not found in database".to_string())?;
        bson::from_bson(option.value)
            .map_err(|error| format!("Failed to parse commentOptions: {error}"))
    }
}
