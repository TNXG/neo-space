#![allow(
    clippy::expect_used,
    clippy::significant_drop_tightening,
    clippy::too_many_lines
)]

use super::*;
use crate::external::{
    meilisearch_admin::MeilisearchAdminClient,
    network::{NetworkOptions, build_client},
};
use axum::{
    Json, Router,
    body::{Body, to_bytes},
    extract::Request,
    routing::any,
};
use std::sync::{Arc, Mutex};

// Reintroducing an SDK-owned client would bypass the fixture and fail DNS; wrong REST bodies break assertions.
#[tokio::test]
async fn indexing_and_search_use_shared_proxy_and_preserve_meilisearch_contract() {
    let requests = Arc::new(Mutex::new(Vec::<(String, Value, String)>::new()));
    let captured = requests.clone();
    let router = Router::new().fallback(any(move |request: Request<Body>| {
        let captured = captured.clone();
        async move {
            let path = request.uri().path_and_query().expect("path").to_string();
            let auth = request.headers().get("authorization").expect("auth").to_str().expect("header").to_string();
            let bytes = to_bytes(request.into_body(), 4096).await.expect("body");
            let body = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).expect("JSON") };
            captured.lock().expect("capture lock").push((path.clone(), body, auth));
            Json(if path.ends_with("/search") {
                serde_json::json!({ "hits": [{ "id": "doc", "ref_id": "post", "lang": "zh", "title": "Title", "text": "Text", "slug": "slug", "category": null, "category_name": null, "tags": [], "created": 1, "_formatted": { "text": "<mark>Text</mark>" }, "_rankingScore": 0.75 }] })
            } else if path.starts_with("/tasks/") {
                serde_json::json!({ "status": "succeeded" })
            } else { serde_json::json!({ "taskUid": 42 }) })
        }
    }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind proxy");
    let port = listener.local_addr().expect("address").port();
    let server = tokio::spawn(async move {
        axum::serve(listener, router).await.expect("serve proxy");
    });
    let client = build_client(
        &NetworkOptions {
            proxy_url: format!("http://127.0.0.1:{port}"),
        },
        &[],
    )
    .expect("transport");
    let search = SearchService {
        client: MeilisearchAdminClient::new(
            "http://search.invalid".into(),
            Some("search-key".into()),
            client,
        ),
    };
    search
        .index_posts(vec![PostDocument {
            id: "doc".into(),
            ref_id: "post".into(),
            lang: "zh".into(),
            title: "Title".into(),
            text: "Text".into(),
            slug: "slug".into(),
            category: None,
            category_name: None,
            tags: vec![],
            created: 1,
        }])
        .await
        .expect("index task");
    let hits = search
        .search_posts("Text", 10, 0, "zh")
        .await
        .expect("search");
    assert_eq!(hits.len(), 1);
    assert_eq!(hits.first().expect("hit").score, 0.75);
    assert_eq!(
        hits.first()
            .expect("hit")
            .formatted
            .get("text")
            .map(String::as_str),
        Some("<mark>Text</mark>")
    );
    search
        .delete_post_documents_by_ref("post")
        .await
        .expect("delete task");
    let requests = requests.lock().expect("requests");
    assert_eq!(requests.len(), 5);
    assert_eq!(
        requests.first().expect("index").0,
        "/indexes/posts/documents?primaryKey=id"
    );
    assert!(
        requests
            .iter()
            .all(|(_, _, auth)| auth == "Bearer search-key")
    );
    let body = &requests
        .iter()
        .find(|(path, _, _)| path.ends_with("/search"))
        .expect("search request")
        .1;
    assert_eq!(
        body.get("filter"),
        Some(&serde_json::json!("lang = \"zh\""))
    );
    assert_eq!(
        body.get("attributesToCrop"),
        Some(&serde_json::json!(["text:80"]))
    );
    let deletion = &requests
        .iter()
        .find(|(path, _, _)| path.ends_with("/documents/delete"))
        .expect("deletion")
        .1;
    assert_eq!(
        deletion,
        &serde_json::json!({ "filter": "ref_id = \"post\"" })
    );
    server.abort();
}
