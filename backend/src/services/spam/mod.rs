//! Spam detection service using AI

mod parser;
mod prompts;

use bson::oid::ObjectId;
use mongodb::{Database, bson::doc};
use serde::Deserialize;

use crate::external::ai::{AiService, AiUsage};
use crate::models::CommentState;
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

fn default_ai_review_type() -> String {
    "binary".to_string()
}

fn default_ai_review_threshold() -> u8 {
    5
}

/// Result of a spam check.
#[derive(Debug, Default)]
pub struct SpamCheckResult {
    pub is_spam: bool,
    pub confidence: f32,
    pub reason: Option<String>,
}

/// Spam detection service.
pub struct SpamDetector;

impl SpamDetector {
    /// Review a single comment in the background.
    pub async fn review_async(
        db: Database,
        http_client: reqwest::Client,
        comment_id: ObjectId,
        text: String,
        author: String,
        email: String,
    ) {
        tracing::info!("Starting async spam review for comment: {}", comment_id);

        let result = Self::check(&db, http_client, &text, &author, &email).await;
        let new_state = if result.is_spam {
            tracing::warn!(
                "Async review: comment {} flagged as spam (confidence: {:.2}) - {:?}",
                comment_id,
                result.confidence,
                result.reason
            );
            CommentState::SPAM
        } else {
            tracing::info!("Async review: comment {} passed spam check", comment_id);
            CommentState::UNREAD
        };

        let collection = db.collection::<mongodb::bson::Document>("comments");
        if let Err(error) = collection
            .update_one(
                doc! { "_id": comment_id },
                doc! { "$set": { "state": new_state } },
            )
            .await
        {
            tracing::error!(
                "Failed to update comment {} state after spam check: {}",
                comment_id,
                error
            );
        }
    }

    /// Run a full spam check and return the result.
    pub async fn check(
        db: &Database,
        http_client: reqwest::Client,
        text: &str,
        author: &str,
        email: &str,
    ) -> SpamCheckResult {
        let options = match Self::get_comment_options(db).await {
            Ok(options) => options,
            Err(error) => {
                tracing::error!("Failed to load comment options for spam check: {}", error);
                return SpamCheckResult::default();
            }
        };

        if !options.anti_spam || !options.ai_review {
            return SpamCheckResult::default();
        }

        let ai_service =
            match AiService::from_database_for_usage(db, http_client, AiUsage::CommentReview).await
            {
                Ok(service) => service,
                Err(error) => {
                    tracing::error!("Failed to create AI service for spam check: {}", error);
                    return SpamCheckResult::default();
                }
            };

        if !ai_service.is_enabled() {
            return SpamCheckResult::default();
        }

        match options.ai_review_type.as_str() {
            "binary" => Self::check_binary(&ai_service, text, author, email).await,
            "score" => {
                Self::check_score(
                    &ai_service,
                    text,
                    author,
                    email,
                    options.ai_review_threshold,
                )
                .await
            }
            other => {
                tracing::warn!("Unknown AI review type '{}', skipping spam check", other);
                SpamCheckResult::default()
            }
        }
    }

    async fn check_binary(
        ai_service: &AiService,
        text: &str,
        author: &str,
        email: &str,
    ) -> SpamCheckResult {
        let messages = build_binary_messages(text, author, email);

        match ai_service.chat(&messages, Some(0.3), None).await {
            Ok(response) => {
                tracing::debug!("AI binary spam response: {}", response);
                parse_binary_response(&response).unwrap_or_else(|error| {
                    tracing::error!("Failed to parse binary spam response: {}", error);
                    SpamCheckResult::default()
                })
            }
            Err(error) => {
                tracing::error!("AI binary spam check failed: {}", error);
                SpamCheckResult::default()
            }
        }
    }

    async fn check_score(
        ai_service: &AiService,
        text: &str,
        author: &str,
        email: &str,
        threshold: u8,
    ) -> SpamCheckResult {
        let messages = build_score_messages(text, author, email, threshold);

        match ai_service.chat(&messages, Some(0.3), None).await {
            Ok(response) => {
                tracing::debug!("AI score spam response: {}", response);
                parse_score_response(&response, threshold).unwrap_or_else(|error| {
                    tracing::error!("Failed to parse score spam response: {}", error);
                    SpamCheckResult::default()
                })
            }
            Err(error) => {
                tracing::error!("AI score spam check failed: {}", error);
                SpamCheckResult::default()
            }
        }
    }

    async fn get_comment_options(db: &Database) -> Result<CommentOptions, String> {
        let collection = db.collection::<RawOption>("options");

        let option = collection
            .find_one(doc! { "name": "commentOptions" })
            .await
            .map_err(|error| format!("Database error: {error}"))?
            .ok_or_else(|| "commentOptions not found in database".to_string())?;

        let document = option
            .value
            .as_document()
            .ok_or_else(|| "commentOptions value is not a document".to_string())?;

        bson::from_document::<CommentOptions>(document.clone())
            .map_err(|error| format!("Failed to parse commentOptions: {error}"))
    }
}
