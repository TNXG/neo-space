use crate::external::ai::{ChatMessage, ChatRole};

pub(super) fn build_binary_messages(text: &str, author: &str, email: &str) -> Vec<ChatMessage> {
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

    let user_prompt =
        format!("请检测以下评论是否为垃圾内容：\n\n作者：{author}\n邮箱：{email}\n内容：{text}");

    vec![
        ChatMessage {
            role: ChatRole::System,
            content: system_prompt.to_string(),
        },
        ChatMessage {
            role: ChatRole::User,
            content: user_prompt,
        },
    ]
}

pub(super) fn build_score_messages(
    text: &str,
    author: &str,
    email: &str,
    threshold: u8,
) -> Vec<ChatMessage> {
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

    vec![
        ChatMessage {
            role: ChatRole::System,
            content: system_prompt,
        },
        ChatMessage {
            role: ChatRole::User,
            content: user_prompt,
        },
    ]
}
