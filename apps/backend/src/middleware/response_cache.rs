//! Cache only explicitly public, anonymous GET responses before compression and CORS.
use axum::{
    body::{Body, to_bytes},
    extract::{MatchedPath, OriginalUri, Request, State},
    http::{Method, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};

use crate::{
    error::AppError,
    services::response_cache::{CachedResponse, ResponseCache},
};

/// Match route templates, not prefixes, so management and unlock routes cannot enter public cache.
fn public_route(path: &str) -> bool {
    matches!(
        path,
        "/api/posts"
            | "/api/posts/{id}"
            | "/api/posts/slug/{slug}"
            | "/api/posts/slug/{slug}/adjacent"
            | "/api/notes"
            | "/api/notes/{id}"
            | "/api/notes/nid/{nid}"
            | "/api/notes/nid/{nid}/adjacent"
            | "/api/pages/{slug}"
            | "/api/links"
            | "/api/links/{id}"
            | "/api/categories"
            | "/api/categories/tags/list"
            | "/api/categories/tags/{name}"
            | "/api/config"
            | "/api/aggregate/nav"
    )
}

/// A credential-bearing request always executes normal authorization and never populates shared data.
pub async fn cache_response(
    State(cache): State<ResponseCache>,
    request: Request,
    next: Next,
) -> Response {
    let path = request
        .extensions()
        .get::<MatchedPath>()
        .map(MatchedPath::as_str);
    if request.method() != Method::GET
        || request.headers().contains_key(header::AUTHORIZATION)
        || request.headers().contains_key(header::COOKIE)
        || !path.is_some_and(public_route)
    {
        return next.run(request).await;
    }

    let uri = request
        .extensions()
        .get::<OriginalUri>()
        .map_or_else(|| request.uri(), |uri| &uri.0);
    let key = cache.key(
        uri.path_and_query()
            .map_or_else(|| uri.path(), |value| value.as_str()),
    );
    if let Some(cached) = cache.entries.get(&key).await {
        let mut response = Response::new(Body::from(cached.body));
        *response.headers_mut() = cached.headers;
        return response;
    }

    let response = next.run(request).await;
    // Never retain errors, response cookies or explicitly private/non-cacheable responses.
    let private = response
        .headers()
        .get(header::CACHE_CONTROL)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value
                .split(',')
                .any(|part| matches!(part.trim(), "private" | "no-store" | "no-cache"))
        });
    if response.status() != StatusCode::OK
        || response.headers().contains_key(header::SET_COOKIE)
        || private
    {
        return response;
    }

    let (parts, body) = response.into_parts();
    match to_bytes(body, usize::MAX).await {
        Ok(body) => {
            cache
                .entries
                .insert(
                    key,
                    CachedResponse {
                        headers: parts.headers.clone(),
                        body: body.clone(),
                    },
                )
                .await;
            Response::from_parts(parts, Body::from(body))
        }
        Err(error) => {
            AppError::Internal(format!("Failed to read API response body: {error}")).into_response()
        }
    }
}
