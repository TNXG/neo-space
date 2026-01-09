//! 垃圾评论检测服务
//!
//! 支持两种检测模式：
//! 1. binary - 二分法：AI 直接判断是/否垃圾评论
//! 2. score - 评分法：AI 给出 0-10 分，根据阈值判断
//!
//! 支持异步审核：先存入数据库，后台异步调用 AI 审核

use mongodb::bson::oid::ObjectId;
use mongodb::{bson::doc, Database};
use serde::Deserialize;

use crate::integrations::{AiService, ChatMessage, ChatRole};
use crate::models::{CommentState, RawOption};
use crate::utils::detection::{parse_binary_response, parse_score_response, SpamCheckResult};

/// 评论配置选项
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommentOptions {
    /// 是否启用反垃圾检测
    #[serde(default)]
    anti_spam: bool,
    /// 是否启用 AI 审核
    #[serde(default)]
    ai_review: bool,
    /// AI 审核类型：binary（二分法）或 score（评分法）
    #[serde(default = "default_ai_review_type")]
    ai_review_type: String,
    /// AI 审核阈值（仅评分法使用，0-10）
    #[serde(default = "default_ai_review_threshold")]
    ai_review_threshold: u8,
}

fn default_ai_review_type() -> String {
    "binary".to_string()
}

fn default_ai_review_threshold() -> u8 {
    5
}

/// 垃圾评论检测器
pub struct SpamDetector;

impl SpamDetector {
    /// 检查是否启用了 AI 审核
    ///
    /// # Returns
    /// * `bool` - 是否启用 AI 审核
    pub async fn is_ai_review_enabled(db: &Database) -> bool {
        match Self::get_comment_options(db).await {
            Ok(opts) => opts.anti_spam && opts.ai_review,
            Err(_) => false,
        }
    }

    /// 异步审核评论（在后台任务中调用）
    pub async fn review_async(
        db: &Database,
        comment_id: ObjectId,
        text: &str,
        author: &str,
        email: &str,
    ) {
        log::info!("开始异步审核评论: {comment_id}");

        // 执行垃圾检测
        let result = Self::check(db, text, author, email).await;

        // 根据结果更新评论状态
        let new_state = if result.is_spam {
            log::warn!(
                "异步审核: 评论 {} 被识别为垃圾 (置信度: {:.2}) - 原因: {:?}",
                comment_id,
                result.confidence,
                result.reason
            );
            CommentState::SPAM
        } else {
            log::info!("异步审核: 评论 {comment_id} 审核通过");
            CommentState::UNREAD
        };

        // 更新数据库
        let collection = db.collection::<mongodb::bson::Document>("comments");
        if let Err(e) = collection
            .update_one(
                doc! { "_id": comment_id },
                doc! { "$set": { "state": new_state } },
            )
            .await
        {
            log::error!("更新评论状态失败: {comment_id} - {e}");
        }
    }

    /// 检测评论是否为垃圾内容
    pub async fn check(db: &Database, text: &str, author: &str, email: &str) -> SpamCheckResult {
        // 1. 获取评论配置
        let comment_options = match Self::get_comment_options(db).await {
            Ok(opts) => opts,
            Err(e) => {
                log::error!("获取评论配置失败: {e}");
                return Self::pass_result();
            }
        };

        // 2. 检查是否启用反垃圾和 AI 审核
        if !comment_options.anti_spam || !comment_options.ai_review {
            log::debug!("反垃圾或 AI 审核未启用");
            return Self::pass_result();
        }

        // 3. 创建 AI 服务
        let ai_service = match AiService::from_database(db).await {
            Ok(service) => service,
            Err(e) => {
                log::error!("创建 AI 服务失败: {e}");
                return Self::pass_result();
            }
        };

        if !ai_service.is_enabled() {
            log::debug!("AI 服务未启用");
            return Self::pass_result();
        }

        // 4. 根据审核类型调用不同的检测方法
        match comment_options.ai_review_type.as_str() {
            "binary" => Self::check_binary(&ai_service, text, author, email).await,
            "score" => {
                Self::check_score(
                    &ai_service,
                    text,
                    author,
                    email,
                    comment_options.ai_review_threshold,
                )
                .await
            }
            _ => {
                log::warn!("未知的 AI 审核类型: {}", comment_options.ai_review_type);
                Self::pass_result()
            }
        }
    }

    /// 二分法检测
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

        match ai_service.chat(messages, Some(0.3), None).await {
            Ok(response) => {
                log::debug!("AI 二分法响应: {response}");
                match parse_binary_response(&response) {
                    Ok(result) => result,
                    Err(e) => {
                        log::error!("{e}");
                        Self::pass_result()
                    }
                }
            }
            Err(e) => {
                log::error!("AI 检测失败: {e}");
                Self::pass_result()
            }
        }
    }

    /// 评分法检测
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

垃圾评论的特征包括但不限于：
- 广告推广、营销信息
- 恶意链接、钓鱼网站
- 无意义的重复字符或乱码
- 辱骂、人身攻击、仇恨言论
- 色情、暴力等不良内容
- 明显的机器人生成内容

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

        match ai_service.chat(messages, Some(0.3), None).await {
            Ok(response) => {
                log::debug!("AI 评分法响应: {response}");
                match parse_score_response(&response, threshold) {
                    Ok(result) => result,
                    Err(e) => {
                        log::error!("{e}");
                        Self::pass_result()
                    }
                }
            }
            Err(e) => {
                log::error!("AI 检测失败: {e}");
                Self::pass_result()
            }
        }
    }

    /// 获取评论配置
    async fn get_comment_options(db: &Database) -> Result<CommentOptions, String> {
        let collection = db.collection::<RawOption>("options");

        let option = collection
            .find_one(doc! { "name": "commentOptions" })
            .await
            .map_err(|e| format!("数据库错误: {e}"))?
            .ok_or_else(|| "评论配置不存在".to_string())?;

        let doc = option
            .value
            .as_document()
            .ok_or_else(|| "评论配置不是文档类型".to_string())?;

        let comment_options: CommentOptions =
            bson::from_document(doc.clone()).map_err(|e| format!("解析评论配置失败: {e}"))?;

        Ok(comment_options)
    }

    fn pass_result() -> SpamCheckResult {
        SpamCheckResult::default()
    }
}
