//! Artwork (cached media cover art) static file serving

use crate::error::{AppError, AppResult};
use axum::{
    body::Body,
    extract::Path,
    http::{HeaderValue, Response, StatusCode},
};
use tokio::io::AsyncReadExt;

/// Serve cached artwork files
pub async fn serve_artwork(Path(filename): Path<String>) -> AppResult<Response<Body>> {
    // Sanitize filename to prevent path traversal
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(AppError::BadRequest("Invalid filename".to_string()));
    }

    // Only allow safe extensions
    let ext = filename.rsplit('.').next().unwrap_or("").to_lowercase();
    if !matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp" | "gif") {
        return Err(AppError::BadRequest("Unsupported file type".to_string()));
    }

    let filepath = format!("./cache/artworks/{}", filename);

    let mut file = tokio::fs::File::open(&filepath)
        .await
        .map_err(|_| AppError::NotFound(format!("Artwork not found: {}", filename)))?;

    let mut contents = Vec::new();
    file.read_to_end(&mut contents)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read artwork: {}", e)))?;

    let content_type = match ext.as_str() {
        "png" => "image/png",
        "webp" => "image/webp",
        "gif" => "image/gif",
        _ => "image/jpeg",
    };

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", HeaderValue::from_static(content_type))
        .header(
            "Cache-Control",
            HeaderValue::from_static("public, max-age=86400"),
        )
        .body(Body::from(contents))
        .map_err(|e| AppError::Internal(format!("Failed to build response: {}", e)))?;

    Ok(response)
}
