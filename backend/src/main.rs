#[macro_use]
extern crate rocket;

mod db;
mod models;
mod routes;

use rocket::http::Method;
use rocket::serde::json::Json;
use rocket::{Request, catch};
use rocket_cors::{AllowedOrigins, CorsOptions};
use models::ApiResponse;

/// 404 Not Found error catcher - returns JSON
#[catch(404)]
fn not_found(_req: &Request) -> Json<ApiResponse<()>> {
    Json(ApiResponse {
        code: 404,
        status: models::ResponseStatus::Failed,
        message: "Resource not found".to_string(),
        data: (),
    })
}

/// 500 Internal Server Error catcher - returns JSON
#[catch(500)]
fn internal_error(_req: &Request) -> Json<ApiResponse<()>> {
    Json(ApiResponse {
        code: 500,
        status: models::ResponseStatus::Failed,
        message: "Internal server error".to_string(),
        data: (),
    })
}

#[launch]
async fn rocket() -> _ {
    // Initialize database connection
    let database = db::init_db().await.expect("Failed to connect to MongoDB");

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
            // Notes routes
            routes::notes::list_notes,
            routes::notes::get_note_by_id,
            // Categories routes
            routes::categories::list_categories,
            // Links routes
            routes::links::list_links,
            // Activities routes
            routes::activities::list_activities,
            // Recentlies (Moments) routes
            routes::recentlies::list_recentlies,
        ])
}
