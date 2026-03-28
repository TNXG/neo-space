//! User and reader routes

use crate::app::SharedState;
use crate::handlers;

/// Create user routes (stateless, to be nested)
pub fn routes() -> axum::Router<SharedState> {
    axum::Router::new()
        // Public user/profile endpoints
        .route(
            "/profile",
            axum::routing::get(handlers::users::get_owner_profile)
                .patch(handlers::users::update_user_profile),
        )
        .route(
            "/handle/check",
            axum::routing::get(handlers::users::check_handle_availability),
        )
        .route(
            "/avatar",
            axum::routing::post(handlers::users::update_avatar),
        )
        // Reader endpoints (public)
        .route(
            "/readers",
            axum::routing::get(handlers::users::list_readers_public),
        )
        .route(
            "/readers/{id}",
            axum::routing::get(handlers::users::get_reader_by_id_public),
        )
        // Admin user management endpoints
        .route("/", axum::routing::get(handlers::admin::users::list_users))
        .route(
            "/{id}",
            axum::routing::get(handlers::admin::users::get_user_by_id)
                .delete(handlers::admin::users::delete_user),
        )
        .route(
            "/{id}/accounts",
            axum::routing::get(handlers::admin::users::list_user_accounts),
        )
        .route(
            "/{id}/accounts/{account_id}",
            axum::routing::delete(handlers::admin::users::delete_user_account),
        )
        .route(
            "/email/{email}",
            axum::routing::get(handlers::admin::users::get_user_by_email),
        )
}
