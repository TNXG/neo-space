use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};

/// Request body for nbnhhsh guess
#[derive(Debug, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct GuessRequest {
    pub text: String,
}

/// Response item from nbnhhsh API
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(crate = "rocket::serde")]
pub struct GuessResult {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trans: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inputting: Option<Vec<String>>,
}

/// Proxy endpoint for nbnhhsh guess API
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
