#[macro_use]
extern crate rocket;

mod config;
mod models;
mod routes;
mod services;
mod utils;

use rocket::http::Method;
use rocket::serde::json::Json;
use rocket::Request;
use rocket_cors::{AllowedOrigins, CorsOptions};
use models::{ApiResponse, ResponseStatus};

/// 404 Not Found error catcher - returns JSON
#[catch(404)]
fn not_found(_req: &Request) -> Json<ApiResponse<()>> {
    Json(ApiResponse {
        code: 404,
        status: ResponseStatus::Failed,
        message: "Resource not found".to_string(),
        data: (),
    })
}

/// 500 Internal Server Error catcher - returns JSON
#[catch(500)]
fn internal_error(_req: &Request) -> Json<ApiResponse<()>> {
    Json(ApiResponse {
        code: 500,
        status: ResponseStatus::Failed,
        message: "Internal server error".to_string(),
        data: (),
    })
}

#[launch]
async fn rocket() -> _ {
    // Initialize database connection
    let database = services::init_db().await.expect("Failed to connect to MongoDB");

    // Configure CORS for frontend communication
    let cors = CorsOptions::default()
        .allowed_origins(AllowedOrigins::all())
        .allowed_methods(
            vec![Method::Get, Method::Post, Method::Put, Method::Delete]
                .into_iter()
                .map(From::from)
                .collect(),
        )
        .allow_credentials(true)
        .to_cors()
        .expect("Failed to create CORS");

    // Build and launch Rocket with modular route registration
    rocket::build()
        .manage(database)
        .attach(cors)
        .register("/", catchers![not_found, internal_error])
        .mount("/api", routes![
            // Posts routes
            routes::posts::list_posts,
            routes::posts::get_post_by_id,
            routes::posts::get_post_by_slug,
            routes::posts::get_adjacent_posts,
            // Notes routes
            routes::notes::list_notes,
            routes::notes::get_note_by_id,
            routes::notes::get_note_by_nid,
            routes::notes::get_adjacent_notes,
            // Categories routes
            routes::categories::list_categories,
            // Comments routes
            routes::comments::list_comments,
            routes::comments::create_comment,
            routes::comments::update_comment,
            routes::comments::delete_comment,
            // Links routes
            routes::links::list_links,
            // Recentlies (Moments) routes
            routes::recentlies::list_recentlies,
            // Users routes
            routes::users::get_user_profile,
            routes::users::list_readers,
            routes::users::get_reader_by_id,
            // Nbnhhsh routes
            routes::nbnhhsh::guess,
            // Pages routes
            routes::pages::get_page_by_slug,
            // Config routes
            routes::config::get_site_config,
            // AI routes
            routes::ai::analyze_time_capsule,
            routes::ai::get_time_capsule,
        ])
}
