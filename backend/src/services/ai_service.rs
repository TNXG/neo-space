//! AI Service - 从数据库获取 AI 配置并提供文本生成能力
//!
//! 使用 OpenAI 兼容 SDK，支持任意 OpenAI 兼容的 API 端点

use async_openai::{
    config::OpenAIConfig,
    types::chat::{
        ChatCompletionRequestAssistantMessageArgs,
        ChatCompletionRequestMessage,
        ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs,
        CreateChatCompletionRequestArgs,
    },
    Client,
};
use mongodb::bson::doc;
use mongodb::Database;
use serde::Deserialize;

use crate::models::RawOption;

/// AI 配置（从数据库读取）
#[derive(Debug, Clone)]
pub struct AiConfig {
    pub enabled: bool,
    pub endpoint: String,
    pub model: String,
    pub api_key: String,
}

/// 数据库中的 AI 配置原始结构
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

/// 对话消息角色
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    System,
    User,
    Assistant,
}

/// 对话消息
#[derive(Debug, Clone, Deserialize)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
}

/// 从数据库获取 AI 配置
pub async fn get_ai_config(database: &Database) -> Result<AiConfig, String> {
    let collection = database.collection::<RawOption>("options");

    let option = collection
        .find_one(doc! { "name": "ai" })
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .ok_or_else(|| "AI configuration not found".to_string())?;

    let doc = option
        .value
        .as_document()
        .ok_or_else(|| "AI options is not a document".to_string())?;
    let ai_options: AiOptionsValue =
        bson::from_document(doc.clone()).map_err(|e| format!("Failed to parse AI options: {}", e))?;

    Ok(AiConfig {
        enabled: ai_options.enable_summary,
        endpoint: ai_options.open_ai_endpoint,
        model: ai_options.open_ai_preferred_model,
        api_key: ai_options.open_ai_key,
    })
}

/// AI 服务
pub struct AiService {
    config: AiConfig,
    client: Client<OpenAIConfig>,
}

impl AiService {
    /// 从配置创建服务实例
    pub fn new(config: AiConfig) -> Self {
        let openai_config = OpenAIConfig::new()
            .with_api_key(&config.api_key)
            .with_api_base(&config.endpoint);

        Self {
            config,
            client: Client::with_config(openai_config),
        }
    }

    /// 从数据库配置创建服务实例
    pub async fn from_database(database: &Database) -> Result<Self, String> {
        let config = get_ai_config(database).await?;
        Ok(Self::new(config))
    }

    /// 检查服务是否启用
    pub fn is_enabled(&self) -> bool {
        self.config.enabled
    }

    /// 获取配置
    #[allow(unused)]
    pub fn config(&self) -> &AiConfig {
        &self.config
    }

    /// 发送对话请求
    ///
    /// # Arguments
    /// * `messages` - 对话消息数组
    /// * `temperature` - 温度参数 (可选)
    /// * `max_tokens` - 最大 token 数 (可选)
    pub async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        temperature: Option<f32>,
        max_tokens: Option<u32>,
    ) -> Result<String, String> {
        if !self.config.enabled {
            return Err("AI service is disabled".to_string());
        }

        // 转换消息格式
        let openai_messages: Vec<ChatCompletionRequestMessage> = messages
            .into_iter()
            .map(|msg| Self::convert_message(msg))
            .collect::<Result<Vec<_>, _>>()?;

        let mut request_builder = CreateChatCompletionRequestArgs::default();
        request_builder
            .model(&self.config.model)
            .messages(openai_messages);

        if let Some(temp) = temperature {
            request_builder.temperature(temp);
        }
        if let Some(tokens) = max_tokens {
            request_builder.max_tokens(tokens as u16);
        }

        let request = request_builder
            .build()
            .map_err(|e| format!("Failed to build request: {}", e))?;

        let response = self
            .client
            .chat()
            .create(request)
            .await
            .map_err(|e| format!("API request failed: {}", e))?;

        response
            .choices
            .first()
            .and_then(|c| c.message.content.clone())
            .ok_or_else(|| "No response generated".to_string())
    }

    /// 转换消息格式
    fn convert_message(msg: ChatMessage) -> Result<ChatCompletionRequestMessage, String> {
        match msg.role {
            ChatRole::System => {
                let message = ChatCompletionRequestSystemMessageArgs::default()
                    .content(msg.content)
                    .build()
                    .map_err(|e| format!("Failed to build system message: {}", e))?;
                Ok(ChatCompletionRequestMessage::System(message))
            }
            ChatRole::User => {
                let message = ChatCompletionRequestUserMessageArgs::default()
                    .content(msg.content)
                    .build()
                    .map_err(|e| format!("Failed to build user message: {}", e))?;
                Ok(ChatCompletionRequestMessage::User(message))
            }
            ChatRole::Assistant => {
                let message = ChatCompletionRequestAssistantMessageArgs::default()
                    .content(msg.content)
                    .build()
                    .map_err(|e| format!("Failed to build assistant message: {}", e))?;
                Ok(ChatCompletionRequestMessage::Assistant(message))
            }
        }
    }
}
