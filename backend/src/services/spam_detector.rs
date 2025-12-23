//! 垃圾评论检测服务
//!
//! 支持两种检测模式：
//! 1. binary - 二分法：AI 直接判断是/否垃圾评论
//! 2. score - 评分法：AI 给出 0-10 分，根据阈值判断
//!
//! 支持异步审核：先存入数据库，后台异步调用 AI 审核

use mongodb::{bson::doc, Database};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

use crate::models::{RawOption, CommentState};
use crate::services::ai_service::{AiService, ChatMessage, ChatRole};

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

/// 垃圾检测结果
#[derive(Debug, Clone, Serialize)]
pub struct SpamCheckResult {
    /// 是否为垃圾评论
    pub is_spam: bool,
    /// 置信度（0.0-1.0）
    pub confidence: f32,
    /// 拒绝原因
    pub reason: Option<String>,
}

/// AI 二分法响应
#[derive(Debug, Deserialize)]
struct BinaryResponse {
    is_spam: bool,
    reason: String,
}

/// AI 评分法响应
#[derive(Debug, Deserialize)]
struct ScoreResponse {
    score: u8,
    reason: String,
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
    /// 
    /// 根据 AI 检测结果更新评论状态：
    /// - 垃圾评论：state = 2 (SPAM)
    /// - 正常评论：state = 0 (UNREAD)
    ///
    /// # Arguments
    /// * `db` - 数据库连接
    /// * `comment_id` - 评论 ID
    /// * `text` - 评论内容
    /// * `author` - 作者昵称
    /// * `email` - 作者邮箱
    pub async fn review_async(
        db: &Database,
        comment_id: ObjectId,
        text: &str,
        author: &str,
        email: &str,
    ) {
        log::info!("开始异步审核评论: {}", comment_id);
        
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
            log::info!("异步审核: 评论 {} 审核通过", comment_id);
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
            log::error!("更新评论状态失败: {} - {}", comment_id, e);
        }
    }

    /// 检测评论是否为垃圾内容（同步检测，用于异步任务内部）
    ///
    /// # Arguments
    /// * `db` - 数据库连接
    /// * `text` - 评论内容
    /// * `author` - 作者昵称
    /// * `email` - 作者邮箱
    ///
    /// # Returns
    /// * `SpamCheckResult` - 检测结果
    pub async fn check(
        db: &Database,
        text: &str,
        author: &str,
        email: &str,
    ) -> SpamCheckResult {
        // 1. 获取评论配置
        let comment_options = match Self::get_comment_options(db).await {
            Ok(opts) => opts,
            Err(e) => {
                log::error!("获取评论配置失败: {}", e);
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
                log::error!("创建 AI 服务失败: {}", e);
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
                Self::check_score(&ai_service, text, author, email, comment_options.ai_review_threshold).await
            }
            _ => {
                log::warn!("未知的 AI 审核类型: {}", comment_options.ai_review_type);
                Self::pass_result()
            }
        }
    }

    /// 二分法检测：AI 直接判断是/否
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
            "请检测以下评论是否为垃圾内容：\n\n作者：{}\n邮箱：{}\n内容：{}",
            author, email, text
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

        match ai_service.chat(messages, Some(0.3), Some(500)).await {
            Ok(response) => {
                log::debug!("AI 二分法响应: {}", response);
                Self::parse_binary_response(&response)
            }
            Err(e) => {
                log::error!("AI 检测失败: {}", e);
                Self::pass_result()
            }
        }
    }

    /// 评分法检测：AI 给出 0-10 分，根据阈值判断
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

只返回 JSON，不要有其他内容。当前阈值为 {}，评分 >= {} 将被拦截。"#,
            threshold, threshold
        );

        let user_prompt = format!(
            "请对以下评论进行垃圾程度评分（0-10）：\n\n作者：{}\n邮箱：{}\n内容：{}",
            author, email, text
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

        match ai_service.chat(messages, Some(0.3), Some(500)).await {
            Ok(response) => {
                log::debug!("AI 评分法响应: {}", response);
                Self::parse_score_response(&response, threshold)
            }
            Err(e) => {
                log::error!("AI 检测失败: {}", e);
                Self::pass_result()
            }
        }
    }

    /// 解析二分法响应
    fn parse_binary_response(response: &str) -> SpamCheckResult {
        // 尝试提取 JSON
        let json_str = Self::extract_json(response);
        
        log::debug!("提取的 JSON: {}", json_str);
        
        match serde_json::from_str::<BinaryResponse>(&json_str) {
            Ok(result) => SpamCheckResult {
                is_spam: result.is_spam,
                confidence: if result.is_spam { 1.0 } else { 0.0 },
                reason: Some(result.reason),
            },
            Err(e) => {
                log::error!("解析 AI 响应失败: {}，原始响应: {}，提取的 JSON: {}", e, response, json_str);
                Self::pass_result()
            }
        }
    }

    /// 解析评分法响应
    fn parse_score_response(response: &str, threshold: u8) -> SpamCheckResult {
        // 尝试提取 JSON
        let json_str = Self::extract_json(response);
        
        match serde_json::from_str::<ScoreResponse>(&json_str) {
            Ok(result) => {
                let score = result.score.min(10); // 确保不超过 10
                let is_spam = score >= threshold;
                let confidence = score as f32 / 10.0;
                
                SpamCheckResult {
                    is_spam,
                    confidence,
                    reason: Some(format!("评分: {}/10 - {}", score, result.reason)),
                }
            }
            Err(e) => {
                log::error!("解析 AI 响应失败: {}，原始响应: {}", e, response);
                Self::pass_result()
            }
        }
    }

    /// 提取响应中的 JSON 内容
    /// 支持多种格式：
    /// - 纯 JSON
    /// - markdown 代码块包裹的 JSON（```json ... ``` 或 ``` ... ```）
    /// - 带有前后文本的 JSON
    /// - 不完整的 JSON（尝试补全）
    fn extract_json(response: &str) -> String {
        let response = response.trim();
        
        // 1. 尝试移除 markdown 代码块标记
        // 匹配 ```json 或 ``` 开头，``` 结尾
        let cleaned = if response.starts_with("```") {
            // 找到第一个换行符后的内容
            let after_first_line = response
                .find('\n')
                .map(|i| &response[i + 1..])
                .unwrap_or(response);
            
            // 移除结尾的 ```
            let without_end = if after_first_line.ends_with("```") {
                &after_first_line[..after_first_line.len() - 3]
            } else if let Some(pos) = after_first_line.rfind("```") {
                &after_first_line[..pos]
            } else {
                after_first_line
            };
            
            without_end.trim().to_string()
        } else {
            response.to_string()
        };
        
        // 2. 尝试找到 JSON 对象的边界
        if let Some(start) = cleaned.find('{') {
            // 找到匹配的结束括号
            let mut depth = 0;
            let mut end_pos = None;
            let chars: Vec<char> = cleaned.chars().collect();
            let mut in_string = false;
            let mut escape_next = false;
            
            for (i, &ch) in chars.iter().enumerate().skip(start) {
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
                            end_pos = Some(i);
                            break;
                        }
                    }
                    _ => {}
                }
            }
            
            if let Some(end) = end_pos {
                return cleaned[start..=end].to_string();
            }
            
            // 3. 如果没找到匹配的结束括号，尝试补全
            // 可能是 JSON 被截断了
            let partial = &cleaned[start..];
            
            // 尝试补全常见的截断情况
            let mut result = partial.to_string();
            
            // 如果以引号内容结尾但没有闭合引号
            if !result.ends_with('}') {
                // 计算需要补全的括号数量
                let open_braces = result.matches('{').count();
                let close_braces = result.matches('}').count();
                let missing = open_braces.saturating_sub(close_braces);
                
                // 如果在字符串中间被截断，先闭合字符串
                let quote_count = result.matches('"').count();
                if quote_count % 2 != 0 {
                    result.push('"');
                }
                
                // 补全括号
                for _ in 0..missing {
                    result.push('}');
                }
            }
            
            return result;
        }
        
        cleaned
    }

    /// 获取评论配置
    async fn get_comment_options(db: &Database) -> Result<CommentOptions, String> {
        let collection = db.collection::<RawOption>("options");

        let option = collection
            .find_one(doc! { "name": "commentOptions" })
            .await
            .map_err(|e| format!("数据库错误: {}", e))?
            .ok_or_else(|| "评论配置不存在".to_string())?;

        let doc = option
            .value
            .as_document()
            .ok_or_else(|| "评论配置不是文档类型".to_string())?;

        let comment_options: CommentOptions = bson::from_document(doc.clone())
            .map_err(|e| format!("解析评论配置失败: {}", e))?;

        Ok(comment_options)
    }

    fn pass_result() -> SpamCheckResult {
        SpamCheckResult {
            is_spam: false,
            confidence: 0.0,
            reason: None,
        }
    }
}