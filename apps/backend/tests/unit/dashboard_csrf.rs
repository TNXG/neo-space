#![allow(clippy::unwrap_used)]

use super::trusted_mutation;
use axum::http::{HeaderMap, HeaderValue};

#[test]
fn cookie_mutations_require_exact_origin_and_custom_header() {
    let frontend = "https://blog.example.com";
    let backend = "https://api.example.com";
    let mut headers = HeaderMap::new();
    headers.insert(
        "origin",
        HeaderValue::from_static("https://blog.example.com"),
    );
    assert!(!trusted_mutation(&headers, frontend, backend));
    headers.insert(
        "x-requested-with",
        HeaderValue::from_static("Neo-Space-Dashboard"),
    );
    assert!(trusted_mutation(&headers, frontend, backend));
    for origin in [
        "null",
        "https://blog.example.com.evil.test",
        "https://evil.test",
    ] {
        headers.insert("origin", HeaderValue::from_str(origin).unwrap());
        assert!(!trusted_mutation(&headers, frontend, backend));
    }
    headers.remove("origin");
    assert!(!trusted_mutation(&headers, frontend, backend));
    assert!(!trusted_mutation(&headers, "", ""));
}
