//! Spam detection service using AI
//!
//! Supports two review modes:
//! - binary: AI answers yes/no whether a comment is spam
//! - score:  AI gives a 0-10 score; comments >= threshold are flagged
//!
//! Designed to run asynchronously: the comment is stored first, then
//! `review_async` is spawned in the background.

use bson::oid::ObjectId;
use mongodb::{Database, bson::doc};
use serde::Deserialize;

use crate::external::ai::{AiService, ChatMessage, ChatRole};
use crate::models::CommentState;
use crate::models::options::RawOption;

// ── Config ─────────────────────────────────────────────────────────────────────

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

// ── Result type ────────────────────────────────────────────────────────────────

/// Result of a spam check
#[derive(Debug, Default)]
pub struct SpamCheckResult {
    pub is_spam: bool,
    pub confidence: f32,
    pub reason: Option<String>,
}

// ── Internal AI response shapes ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct BinaryResponse {
    is_spam: bool,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct ScoreResponse {
    score: u8,
    reason: String,
}

// ── SpamDetector ───────────────────────────────────────────────────────────────

/// Spam detection service
pub struct SpamDetector;

impl SpamDetector {
    /// Review a single comment in the background.
    ///
    /// Fetches configuration and AI settings, runs the check, then updates the
    /// comment's `state` field in MongoDB.
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
        if let Err(e) = collection
            .update_one(
                doc! { "_id": comment_id },
                doc! { "$set": { "state": new_state } },
            )
            .await
        {
            tracing::error!(
                "Failed to update comment {} state after spam check: {}",
                comment_id,
                e
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
        let opts = match Self::get_comment_options(db).await {
            Ok(o) => o,
            Err(e) => {
                tracing::error!("Failed to load comment options for spam check: {}", e);
                return SpamCheckResult::default();
            }
        };

        if !opts.anti_spam || !opts.ai_review {
            return SpamCheckResult::default();
        }

        let ai_service = match AiService::from_database(db, http_client).await {
            Ok(svc) => svc,
            Err(e) => {
                tracing::error!("Failed to create AI service for spam check: {}", e);
                return SpamCheckResult::default();
            }
        };

        if !ai_service.is_enabled() {
            return SpamCheckResult::default();
        }

        match opts.ai_review_type.as_str() {
            "binary" => Self::check_binary(&ai_service, text, author, email).await,
            "score" => {
                Self::check_score(&ai_service, text, author, email, opts.ai_review_threshold).await
            }
            other => {
                tracing::warn!("Unknown AI review type '{}', skipping spam check", other);
                SpamCheckResult::default()
            }
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    async fn check_binary(
        ai_service: &AiService,
        text: &str,
        author: &str,
        email: &str,
    ) -> SpamCheckResult {
        let system_prompt = r#"你是一个专业的垃圾评论检测助手。你的任务是判断用户提交的评论是否为垃圾内容。

垃圾评论的特征包括但不限于：
- 广告推广、营销信息
- 恶意链接、钓鱼网站
- 无意义的重复字符或乱码
- 辱骂、人身攻击、仇恨言论
- 色情、暴力等不良内容
- 明显的机器人生成内容

请以 JSON 格式返回检测结果：
{
  "is_spam": true/false,
  "reason": "判断理由"
}

只返回 JSON，不要有其他内容。"#;

        let user_prompt = format!(
            "请检测以下评论是否为垃圾内容：\n\n作者：{author}\n邮箱：{email}\n内容：{text}"
        );

        let messages = vec![
            ChatMessage {
                role: ChatRole::System,
                content: system_prompt.to_string(),
            },
            ChatMessage {
                role: ChatRole::User,
                content: user_prompt,
            },
        ];

        match ai_service.chat(&messages, Some(0.3), None).await {
            Ok(response) => {
                tracing::debug!("AI binary spam response: {}", response);
                match Self::parse_binary(&response) {
                    Ok(result) => result,
                    Err(e) => {
                        tracing::error!("Failed to parse binary spam response: {}", e);
                        SpamCheckResult::default()
                    }
                }
            }
            Err(e) => {
                tracing::error!("AI binary spam check failed: {}", e);
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
        let system_prompt = format!(
            r#"你是一个专业的垃圾评论检测助手。你的任务是对用户提交的评论进行评分，判断其垃圾程度。

评分标准（0-10 分）：
- 0-2 分：正常评论，无任何垃圾特征
- 3-4 分：略有可疑，但基本正常
- 5-6 分：可疑内容，可能是垃圾评论
- 7-8 分：明显的垃圾特征
- 9-10 分：严重的垃圾内容

请以 JSON 格式返回检测结果：
{{
  "score": 0-10,
  "reason": "评分理由"
}}

只返回 JSON，不要有其他内容。当前阈值为 {threshold}，评分 >= {threshold} 将被拦截。"#
        );

        let user_prompt = format!(
            "请对以下评论进行垃圾程度评分（0-10）：\n\n作者：{author}\n邮箱：{email}\n内容：{text}"
        );

        let messages = vec![
            ChatMessage {
                role: ChatRole::System,
                content: system_prompt,
            },
            ChatMessage {
                role: ChatRole::User,
                content: user_prompt,
            },
        ];

        match ai_service.chat(&messages, Some(0.3), None).await {
            Ok(response) => {
                tracing::debug!("AI score spam response: {}", response);
                match Self::parse_score(&response, threshold) {
                    Ok(result) => result,
                    Err(e) => {
                        tracing::error!("Failed to parse score spam response: {}", e);
                        SpamCheckResult::default()
                    }
                }
            }
            Err(e) => {
                tracing::error!("AI score spam check failed: {}", e);
                SpamCheckResult::default()
            }
        }
    }

    async fn get_comment_options(db: &Database) -> Result<CommentOptions, String> {
        let collection = db.collection::<RawOption>("options");

        let option = collection
            .find_one(doc! { "name": "commentOptions" })
            .await
            .map_err(|e| format!("Database error: {e}"))?
            .ok_or_else(|| "commentOptions not found in database".to_string())?;

        let doc = option
            .value
            .as_document()
            .ok_or_else(|| "commentOptions value is not a document".to_string())?;

        bson::from_document::<CommentOptions>(doc.clone())
            .map_err(|e| format!("Failed to parse commentOptions: {e}"))
    }

    fn parse_binary(response: &str) -> Result<SpamCheckResult, String> {
        let json_str = Self::extract_json(response);
        serde_json::from_str::<BinaryResponse>(&json_str)
            .map(|res| SpamCheckResult {
                is_spam: res.is_spam,
                confidence: if res.is_spam { 1.0 } else { 0.0 },
                reason: Some(res.reason),
            })
            .map_err(|e| format!("JSON parse error: {e}, input: {json_str}"))
    }

    fn parse_score(response: &str, threshold: u8) -> Result<SpamCheckResult, String> {
        let json_str = Self::extract_json(response);
        serde_json::from_str::<ScoreResponse>(&json_str)
            .map(|res| {
                let score = res.score.min(10);
                SpamCheckResult {
                    is_spam: score >= threshold,
                    confidence: f32::from(score) / 10.0,
                    reason: Some(format!("Score: {}/10 - {}", score, res.reason)),
                }
            })
            .map_err(|e| format!("JSON parse error: {e}, input: {json_str}"))
    }

    /// Extract the first complete JSON object from an AI response that may
    /// contain surrounding prose or markdown code fences.
    fn extract_json(response: &str) -> String {
        let response = response.trim();

        // Strip markdown code fences (```json ... ```)
        let cleaned = if response.starts_with("```") {
            let stripped = response
                .trim_start_matches('`')
                .trim_start_matches("json")
                .trim_start();
            if let Some(end) = stripped.rfind("```") {
                stripped[..end].trim()
            } else {
                stripped.trim()
            }
        } else {
            response
        };

        let Some(start) = cleaned.find('{') else {
            return cleaned.to_string();
        };

        let mut depth: i32 = 0;
        let mut in_string = false;
        let mut escape_next = false;
        let mut end_idx = None;

        for (idx, ch) in cleaned[start..].char_indices() {
            if escape_next {
                escape_next = false;
                continue;
            }
            match ch {
                '\\' if in_string => escape_next = true,
                '"' => in_string = !in_string,
                '{' if !in_string => depth += 1,
                '}' if !in_string => {
                    depth -= 1;
                    if depth == 0 {
                        end_idx = Some(start + idx);
                        break;
                    }
                }
                _ => {}
            }
        }

        match end_idx {
            Some(end) => cleaned[start..=end].to_string(),
            None => cleaned[start..].to_string(),
        }
    }
}
