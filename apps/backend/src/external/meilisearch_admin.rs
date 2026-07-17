//! Meilisearch 管理 API 客户端，供后台运维功能使用。

use reqwest::{Method, Response};
use serde::Serialize;
use serde_json::{Value, json};
use tokio::time::{Duration, sleep};

use crate::{app::SharedState, error::AppError};

/// 面向管理端的轻量 Meilisearch HTTP 客户端。
#[derive(Clone)]
pub struct MeilisearchAdminClient {
    base_url: String,
    api_key: Option<String>,
    http_client: reqwest::Client,
}

impl MeilisearchAdminClient {
    /// 从应用运行时配置创建客户端。
    pub fn from_state(state: &SharedState) -> Self {
        Self {
            base_url: state
                .config
                .meilisearch_host
                .trim_end_matches('/')
                .to_string(),
            api_key: (!state.config.meilisearch_api_key.is_empty())
                .then(|| state.config.meilisearch_api_key.clone()),
            http_client: state.http_client.clone(),
        }
    }

    /// 发送无请求体的管理请求。
    pub async fn request(&self, method: Method, path: &str) -> Result<Value, AppError> {
        self.send(self.authorized(method, path)).await
    }

    /// 发送 JSON 管理请求。
    pub async fn request_json<T: Serialize + ?Sized>(
        &self,
        method: Method,
        path: &str,
        body: &T,
    ) -> Result<Value, AppError> {
        self.send(self.authorized(method, path).json(body)).await
    }

    /// 创建带鉴权信息的请求。
    fn authorized(&self, method: Method, path: &str) -> reqwest::RequestBuilder {
        let request = self
            .http_client
            .request(method, format!("{}{}", self.base_url, path));
        match &self.api_key {
            Some(api_key) => request.bearer_auth(api_key),
            None => request,
        }
    }

    /// 统一解析 Meilisearch 响应并保留可诊断错误信息。
    async fn send(&self, request: reqwest::RequestBuilder) -> Result<Value, AppError> {
        let response = request
            .send()
            .await
            .map_err(|error| AppError::Internal(format!("Meilisearch 请求失败: {error}")))?;
        Self::parse_response(response).await
    }

    /// 将成功响应解析为 JSON，将错误响应转换为业务错误。
    async fn parse_response(response: Response) -> Result<Value, AppError> {
        let status = response.status();
        let body = response
            .text()
            .await
            .map_err(|error| AppError::Internal(format!("读取 Meilisearch 响应失败: {error}")))?;
        if !status.is_success() {
            return Err(AppError::BadRequest(format!(
                "Meilisearch 返回 HTTP {}: {}",
                status.as_u16(),
                body
            )));
        }
        if body.is_empty() {
            return Ok(Value::Null);
        }
        serde_json::from_str(&body)
            .map_err(|error| AppError::Internal(format!("解析 Meilisearch 响应失败: {error}")))
    }

    /// 等待 Meilisearch 异步任务结束，并返回最终任务详情。
    pub async fn wait_for_task(&self, task_uid: u64) -> Result<Value, AppError> {
        for _ in 0..600 {
            let task = self
                .request(Method::GET, &format!("/tasks/{task_uid}"))
                .await?;
            match task.get("status").and_then(Value::as_str) {
                Some("succeeded") => return Ok(task),
                Some("failed") | Some("canceled") => {
                    return Err(AppError::BadRequest(format!(
                        "Meilisearch 任务 {task_uid} 未成功: {task}"
                    )));
                }
                _ => sleep(Duration::from_millis(200)).await,
            }
        }
        Err(AppError::Internal(format!(
            "等待 Meilisearch 任务 {task_uid} 超时"
        )))
    }

    /// 执行异步请求并等待其任务完成。
    pub async fn request_task<T: Serialize + ?Sized>(
        &self,
        method: Method,
        path: &str,
        body: &T,
    ) -> Result<Value, AppError> {
        let queued = self.request_json(method, path, body).await?;
        let task_uid = queued
            .get("taskUid")
            .and_then(Value::as_u64)
            .ok_or_else(|| AppError::Internal(format!("Meilisearch 未返回 taskUid: {queued}")))?;
        self.wait_for_task(task_uid).await
    }

    /// 创建索引并等待创建完成。
    pub async fn create_index(&self, uid: &str, primary_key: &str) -> Result<(), AppError> {
        self.request_task(
            Method::POST,
            "/indexes",
            &json!({ "uid": uid, "primaryKey": primary_key }),
        )
        .await?;
        Ok(())
    }

    /// 删除索引；用于清理原子交换后的旧索引。
    pub async fn delete_index(&self, uid: &str) -> Result<(), AppError> {
        let queued = self
            .request(Method::DELETE, &format!("/indexes/{uid}"))
            .await?;
        let task_uid = queued
            .get("taskUid")
            .and_then(Value::as_u64)
            .ok_or_else(|| AppError::Internal("删除索引未返回 taskUid".to_string()))?;
        self.wait_for_task(task_uid).await?;
        Ok(())
    }
}
