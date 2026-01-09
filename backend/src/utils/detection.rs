//! 内容检测工具函数
//! 提供垃圾评论检测相关的纯函数工具，如 JSON 提取、响应解析等。

use serde::{Deserialize, Serialize};

/// 垃圾检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpamCheckResult {
    /// 是否为垃圾评论
    pub is_spam: bool,
    /// 置信度（0.0-1.0）
    pub confidence: f32,
    /// 拒绝原因
    pub reason: Option<String>,
}

impl Default for SpamCheckResult {
    fn default() -> Self {
        Self {
            is_spam: false,
            confidence: 0.0,
            reason: None,
        }
    }
}

/// 内部模型：AI 二分法响应
#[derive(Debug, Deserialize)]
struct BinaryResponse {
    is_spam: bool,
    reason: String,
}

/// 内部模型：AI 评分法响应
#[derive(Debug, Deserialize)]
struct ScoreResponse {
    score: u8,
    reason: String,
}

/// 提取响应中的 JSON 内容
///
/// 修复了原版代码中的语法错误，并优化了匹配逻辑
pub fn extract_json(response: &str) -> String {
    let response = response.trim();

    // 1. 尝试移除 markdown 代码块标记 (```json ... ```)
    let cleaned = if response.starts_with("```") {
        let content = response
            .trim_start_matches('`')
            .trim_start_matches("json")
            .trim_start();
        if let Some(end_pos) = content.rfind("```") {
            content[..end_pos].trim()
        } else {
            content.trim()
        }
    } else {
        response
    };

    // 2. 寻找第一个 '{'
    let start_idx = match cleaned.find('{') {
        Some(idx) => idx,
        None => return cleaned.to_string(), // 找不到则返回原样供解析器报错
    };

    // 3. 寻找匹配的 '}'
    let mut depth = 0;
    let mut last_valid_end = None;
    let mut in_string = false;
    let mut escape_next = false;

    // 从 '{' 开始遍历
    for (idx, ch) in cleaned[start_idx..].char_indices() {
        let actual_idx = start_idx + idx;

        if escape_next {
            escape_next = false;
            continue;
        }

        match ch {
            '\\' => {
                if in_string {
                    escape_next = true;
                }
            }
            '\"' => in_string = !in_string,
            '{' if !in_string => depth += 1,
            '}' if !in_string => {
                depth -= 1;
                if depth == 0 {
                    last_valid_end = Some(actual_idx);
                    break; // 找到完整的 JSON，立即停止
                }
            }
            _ => {}
        }
    }

    // 4. 处理提取和补全
    if let Some(end_idx) = last_valid_end {
        // 完整提取（只提取到第一个完整的 JSON 对象）
        cleaned[start_idx..=end_idx].to_string()
    } else {
        // 情况 A: 没找到闭合括号，说明 JSON 被截断了
        let mut partial = cleaned[start_idx..].to_string();

        // 如果在字符串内被截断，补全引号
        if in_string {
            partial.push('\"');
        }

        // 补全缺失的括号
        let open_braces = partial.matches('{').count();
        let close_braces = partial.matches('}').count();
        if open_braces > close_braces {
            for _ in 0..(open_braces - close_braces) {
                partial.push('}');
            }
        }
        partial
    }
}

/// 解析二分法响应 (Input: {"`is_spam"`: true, "reason": "..."})
pub fn parse_binary_response(response: &str) -> Result<SpamCheckResult, String> {
    let json_str = extract_json(response);
    serde_json::from_str::<BinaryResponse>(&json_str)
        .map(|res| SpamCheckResult {
            is_spam: res.is_spam,
            confidence: if res.is_spam { 1.0 } else { 0.0 },
            reason: Some(res.reason),
        })
        .map_err(|e| format!("JSON解析失败: {e}, 提取内容: {json_str}"))
}

/// 解析评分法响应 (Input: {"score": 8, "reason": "..."})
/// threshold: 判为垃圾的起始分（例如 7）
pub fn parse_score_response(response: &str, threshold: u8) -> Result<SpamCheckResult, String> {
    let json_str = extract_json(response);
    serde_json::from_str::<ScoreResponse>(&json_str)
        .map(|res| {
            let score = res.score.min(10);
            SpamCheckResult {
                is_spam: score >= threshold,
                confidence: f32::from(score) / 10.0,
                reason: Some(format!("评分: {}/10 - {}", score, res.reason)),
            }
        })
        .map_err(|e| format!("JSON解析失败: {e}, 提取内容: {json_str}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_truncated_json() {
        let raw = "这里是结果：```json\n{\"is_spam\": true, \"reason\": \"垃圾广";
        let cleaned = extract_json(raw);
        assert!(cleaned.ends_with("\"}"));
        assert!(serde_json::from_str::<serde_json::Value>(&cleaned).is_ok());
    }

    #[test]
    fn test_parse_binary() {
        // 测试 JSON 前后有额外文本的情况
        let raw = "AI 的废话 {\"is_spam\": false, \"reason\": \"正常评论\"} 又是废话";
        let res = parse_binary_response(raw);
        assert!(
            res.is_ok(),
            "Failed to parse binary response: {:?}",
            res.err()
        );
        if let Ok(result) = res {
            assert!(!result.is_spam);
        }

        // 测试纯 JSON
        let raw2 = "{\"is_spam\": true, \"reason\": \"垃圾评论\"}";
        let res2 = parse_binary_response(raw2);
        assert!(
            res2.is_ok(),
            "Failed to parse binary response: {:?}",
            res2.err()
        );
        if let Ok(result2) = res2 {
            assert!(result2.is_spam);
        }
    }
}
