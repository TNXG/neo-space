//! OpenAPI documentation configuration

use utoipa::OpenApi;

/// API documentation
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Neo Space API",
        version = "1.0.0",
        description = "Neo Space 博客系统 API 文档",
        contact(
            name = "API Support"
        )
    ),
    paths(
        // Health check
        crate::routes::health::health_check,
    ),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "auth", description = "Authentication endpoints"),
        (name = "posts", description = "Post/article endpoints"),
        (name = "notes", description = "Note/diary endpoints"),
        (name = "pages", description = "Page endpoints"),
        (name = "comments", description = "Comment endpoints"),
        (name = "links", description = "Friend link endpoints"),
        (name = "categories", description = "Category endpoints"),
        (name = "recentlies", description = "Moments/recentlies endpoints"),
        (name = "search", description = "Search endpoints"),
        (name = "config", description = "Site configuration endpoints"),
    )
)]
pub struct ApiDoc;
