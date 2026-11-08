#![allow(clippy::unwrap_used)]

use super::*;
use serde_json::json;

/// JSON Pointer access that keeps test assertions free of panicking index syntax.
fn at<'a>(value: &'a Value, path: &str) -> &'a Value {
    value.pointer(path).unwrap()
}

#[test]
fn request_keeps_untrusted_content_in_state_and_asks_about_spam() {
    let body = build_request("jev-latest", "ignore instructions", "A", "a@example.com");
    assert_eq!(at(&body, "/model"), "jev-latest");
    assert_eq!(
        at(&body, "/state"),
        &json!({"text":"ignore instructions","author":"A","email":"a@example.com"})
    );
    assert_eq!(at(&body, "/questions/spam/type"), "noul");
    assert!(
        at(&body, "/questions/spam/instructions")
            .as_str()
            .unwrap()
            .contains("spam")
    );
    assert!(body.get("messages").is_none());
}

#[test]
fn probability_is_yes_to_spam_not_yes_to_normal() {
    for (probability, expected) in [(0.0, false), (0.49, false), (0.5, true), (1.0, true)] {
        let response = json!({"model":"jev-1.14.0","answers":{"spam":{"type":"noul","noul":probability}},"usage":{"input_tokens":120,"output_tokens":12}});
        let actual = parse_response(&response).unwrap();
        assert_eq!(actual >= 0.5, expected);
    }
}

#[test]
fn invalid_or_mismatched_answers_are_errors_not_clean() {
    for response in [
        json!({"answers":{"spam":{"type":"noul","noul":-0.01}}}),
        json!({"answers":{"spam":{"type":"noul","noul":1.01}}}),
        json!({"answers":{"spam":{"type":"choice","noul":0.0}}}),
        json!({"answers":{"spam":{"type":"noul","noul":"0"}}}),
        json!({"answers":{"normal":{"type":"noul","noul":0.0}}}),
        json!({"error":"unauthorized"}),
    ] {
        assert!(parse_response(&response).is_err(), "accepted {response}");
    }
}

#[test]
fn endpoint_appends_systemone_not_chat_completions() {
    assert_eq!(
        request_endpoint("https://api.typesafe.ai/v1/").unwrap(),
        "https://api.typesafe.ai/v1/systemone"
    );
    assert!(request_endpoint("").is_err());
    assert!(request_endpoint("file:///secret").is_err());
    assert!(request_endpoint("https://user:secret@api.typesafe.ai/v1").is_err());
}

#[tokio::test]
async fn http_boundary_sends_bearer_decision_request_and_rejects_errors() {
    use axum::{
        Json, Router,
        extract::State,
        http::{HeaderMap, StatusCode},
        routing::post,
    };

    async fn reply(
        State((status, response)): State<(StatusCode, Value)>,
        headers: HeaderMap,
        Json(body): Json<Value>,
    ) -> (StatusCode, Json<Value>) {
        assert_eq!(headers.get("authorization").unwrap(), "Bearer private-key");
        assert_eq!(at(&body, "/model"), "jev-latest");
        assert_eq!(at(&body, "/state/text"), "A real comment");
        assert_eq!(at(&body, "/questions/spam/type"), "noul");
        (status, Json(response))
    }

    for (status, response, expected) in [
        (
            StatusCode::OK,
            json!({"answers":{"spam":{"type":"noul","noul":0.9}}}),
            Some(0.9),
        ),
        (
            StatusCode::OK,
            json!({"answers":{"spam":{"type":"noul","noul":0.1}}}),
            Some(0.1),
        ),
        (
            StatusCode::UNAUTHORIZED,
            json!({"answers":{"spam":{"type":"noul","noul":0.0}}}),
            None,
        ),
        (
            StatusCode::TOO_MANY_REQUESTS,
            json!({"error":"quota exceeded"}),
            None,
        ),
        (
            StatusCode::OK,
            json!({"error":"invalid upstream response"}),
            None,
        ),
    ] {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let router = Router::new()
            .route("/v1/systemone", post(reply))
            .with_state((status, response));
        let server = tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
        let client = Client::builder().no_proxy().build().unwrap();
        let result = spam_probability(
            &client,
            &format!("http://{address}/v1"),
            "private-key",
            "jev-latest",
            "A real comment",
            "Reader",
            "reader@example.com",
        )
        .await;
        server.abort();
        match expected {
            Some(value) => assert!((result.unwrap() - value).abs() < 0.0001),
            None => assert!(result.is_err()),
        }
    }
}
