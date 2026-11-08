//! Cookie-authenticated browser writes require a trusted Origin and a non-simple header.
use crate::{app::SharedState, error::AppError};
use axum::{
    extract::{Request, State},
    http::{HeaderMap, Method, header},
    middleware::Next,
    response::Response,
};

fn trusted_mutation(headers: &HeaderMap, frontend: &str, backend: &str) -> bool {
    let origin = headers
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let allowed = !origin.is_empty()
        && (origin == frontend
            || origin == backend
            || (cfg!(debug_assertions)
                && matches!(origin, "http://localhost:3000" | "http://localhost:3001")));
    let ajax = headers
        .get("x-requested-with")
        .and_then(|v| v.to_str().ok())
        == Some("Neo-Space-Dashboard");
    allowed && ajax
}

pub async fn guard(
    State(state): State<SharedState>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let unsafe_method = !matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    );
    let cookie_auth = request
        .headers()
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| {
            v.split(';')
                .any(|c| c.trim().starts_with("admin-auth-token="))
        });
    let login = request.uri().path() == "/api/auth/tokens"
        || request
            .uri()
            .path()
            .starts_with("/api/auth/passkeys/authenticate/");
    let bearer = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("Bearer "));
    if unsafe_method && !bearer && (cookie_auth || login) {
        let config = state.config();
        if !trusted_mutation(request.headers(), &config.frontend_url, &config.backend_url) {
            return Err(AppError::Forbidden);
        }
    }
    Ok(next.run(request).await)
}

#[cfg(test)]
#[path = "../../tests/unit/dashboard_csrf.rs"]
mod tests;
