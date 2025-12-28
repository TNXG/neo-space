use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Request body for nbnhhsh guess
#[derive(Debug, Deserialize, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct GuessRequest {
    /// 要猜测的文本
    pub text: String,
}

/// Response item from nbnhhsh API
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
#[serde(crate = "rocket::serde")]
pub struct GuessResult {
    /// 原始文本
    pub name: String,
    /// 翻译结果
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trans: Option<Vec<String>>,
    /// 正在输入的候选
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inputting: Option<Vec<String>>,
}

/// Proxy endpoint for nbnhhsh guess API
#[utoipa::path(
    post,
    path = "/api/nbnhhsh/guess",
    request_body = GuessRequest,
    responses(
        (status = 200, description = "成功获取猜测结果", body = Vec<GuessResult>)
    ),
    tag = "工具接口"
)]
#[post("/nbnhhsh/guess", data = "<request>")]
pub async fn guess(request: Json<GuessRequest>) -> Json<Vec<GuessResult>> {
    let client = reqwest::Client::new();
    
    let result = client
        .post("https://lab.magiconch.com/api/nbnhhsh/guess")
        .json(&serde_json::json!({ "text": request.text }))
        .send()
        .await;

    match result {
        Ok(response) => {
            if let Ok(data) = response.json::<Vec<GuessResult>>().await {
                Json(data)
            } else {
                Json(vec![])
            }
        }
        Err(_) => Json(vec![]),
    }
}
