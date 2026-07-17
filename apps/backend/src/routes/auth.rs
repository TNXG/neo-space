//! Authentication and OAuth routes

use crate::app::SharedState;
use crate::handlers;

/// Create authentication routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        // Admin dashboard JWT auth
        .route(
            "/tokens",
            axum::routing::get(handlers::auth::get_current_token_user)
                .post(handlers::auth::create_token)
                .delete(handlers::auth::delete_token),
        )
        // Current user info
        .route("/me", axum::routing::get(handlers::auth::get_current_user))
        // OAuth routes
        .route(
            "/oauth/github",
            axum::routing::get(handlers::oauth::github_oauth),
        )
        .route(
            "/oauth/github/callback",
            axum::routing::get(handlers::oauth::github_callback),
        )
        .route("/oauth/qq", axum::routing::get(handlers::oauth::qq_oauth))
        .route(
            "/oauth/qq/callback",
            axum::routing::get(handlers::oauth::qq_callback),
        )
        // Identity binding
        .route(
            "/bindable-identities",
            axum::routing::get(handlers::oauth::get_bindable_identities),
        )
        .route(
            "/bind-anonymous",
            axum::routing::post(handlers::oauth::bind_anonymous),
        )
        .route(
            "/skip-bind",
            axum::routing::post(handlers::oauth::skip_bind),
        )
        // Account management
        .route(
            "/accounts",
            axum::routing::get(handlers::auth::get_user_accounts),
        )
        .route(
            "/avatar",
            axum::routing::put(handlers::auth::update_user_avatar),
        )
        // Passkey 注册、管理与登录
        .route(
            "/passkeys",
            axum::routing::get(handlers::passkey::list_passkeys),
        )
        .route(
            "/passkeys/{id}",
            axum::routing::delete(handlers::passkey::delete_passkey),
        )
        .route(
            "/passkeys/register/start",
            axum::routing::post(handlers::passkey::start_registration),
        )
        .route(
            "/passkeys/register/finish",
            axum::routing::post(handlers::passkey::finish_registration),
        )
        .route(
            "/passkeys/authenticate/start",
            axum::routing::post(handlers::passkey::start_authentication),
        )
        .route(
            "/passkeys/authenticate/finish",
            axum::routing::post(handlers::passkey::finish_authentication),
        )
}
