//! Owner desktop client WebSocket endpoint
//!
//! Handles WebSocket connections from the owner's desktop client,
//! receiving window info, media playback updates, and artwork uploads.

use super::common::broadcast_to_all_readers;
use crate::app::SharedState;
use crate::models::realtime::*;
use axum::{
    extract::{
        Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures::sink::SinkExt;
use serde::Deserialize;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;

/// WebSocket query parameters with token authentication (owner desktop)
#[derive(Debug, Deserialize)]
pub struct WsQueryParams {
    pub token: Option<String>,
}

/// Owner desktop WebSocket endpoint
pub async fn owner_desktop_ws(
    State(state): State<SharedState>,
    ws: WebSocketUpgrade,
    Query(params): Query<WsQueryParams>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_connection(socket, params.token, state))
}

/// Handle WebSocket connection
async fn handle_connection(mut socket: WebSocket, token: Option<String>, state: SharedState) {
    // Verify token
    if let Err(error_msg) = verify_token(token) {
        tracing::warn!("Owner desktop WebSocket auth failed: {}", error_msg);

        let error = ServerToOwnerDesktopMessage::Error {
            message: error_msg.clone(),
        };
        if let Ok(json) = error.to_json() {
            let _ = socket.send(Message::Text(json.into())).await;
        }

        let _ = socket.close().await;
        return;
    }

    tracing::info!("Owner desktop WebSocket authenticated and connected");

    // Send connected message
    let connected_msg = ServerToOwnerDesktopMessage::Connected;
    if let Ok(json) = connected_msg.to_json() {
        let _ = socket.send(Message::Text(json.into())).await;
    }

    // Handle messages loop
    while let Some(result) = socket.recv().await {
        match result {
            Ok(Message::Text(text)) => match handle_message(&text, &state).await {
                Ok(Some(response)) => {
                    if let Ok(json) = response.to_json() {
                        let _ = socket.send(Message::Text(json.into())).await;
                    }
                }
                Ok(None) => {}
                Err(e) => {
                    tracing::error!("Failed to handle owner desktop message: {}", e);
                    let error_msg = ServerToOwnerDesktopMessage::Error { message: e };
                    if let Ok(json) = error_msg.to_json() {
                        let _ = socket.send(Message::Text(json.into())).await;
                    }
                }
            },
            Ok(Message::Close(_)) => {
                tracing::info!("Owner desktop client closed connection");
                break;
            }
            Ok(Message::Ping(data)) => {
                let _ = socket.send(Message::Pong(data)).await;
            }
            Err(e) => {
                tracing::error!("WebSocket error: {}", e);
                break;
            }
            _ => {}
        }
    }

    tracing::info!("Owner desktop client disconnected");
}

/// Verify owner desktop token
fn verify_token(token: Option<String>) -> Result<(), String> {
    let expected_token = std::env::var("OWNER_DESKTOP_TOKEN")
        .map_err(|_| "Server config error: OWNER_DESKTOP_TOKEN not set".to_string())?;

    let provided = token.unwrap_or_default();

    // Constant-time comparison to prevent timing attacks
    let expected_bytes = expected_token.as_bytes();
    let provided_bytes = provided.as_bytes();

    // Check lengths first (avoids short-circuit comparison)
    if expected_bytes.len() != provided_bytes.len() {
        return Err("Authentication failed: invalid token".to_string());
    }

    let matches = expected_bytes
        .iter()
        .zip(provided_bytes.iter())
        .fold(0u8, |acc, (a, b)| acc | (a ^ b));

    if matches != 0 {
        return Err("Authentication failed: invalid token".to_string());
    }

    Ok(())
}

/// Handle owner desktop client message
async fn handle_message(
    text: &str,
    _state: &SharedState,
) -> Result<Option<ServerToOwnerDesktopMessage>, String> {
    let desktop_msg: OwnerDesktopMessage =
        serde_json::from_str(text).map_err(|e| format!("Failed to parse message: {}", e))?;

    match desktop_msg {
        OwnerDesktopMessage::WindowInfo { data } => {
            tracing::info!(
                "Received owner window info: title={}, process={}, app_id={:?}",
                data.title,
                data.process_name,
                data.app_id
            );
            // Broadcast to WebSocket readers
            let now = chrono::Utc::now().timestamp();
            tokio::spawn(async move {
                broadcast_to_all_readers(
                    ServerToReaderMessage::OwnerWindowInfo {
                        window_info: data,
                        updated_at: now,
                    },
                )
                .await;
            });
            Ok(None)
        }
        OwnerDesktopMessage::MediaPlayback {
            metadata,
            playback_state,
        } => {
            tracing::info!(
                "Received owner media playback: title={:?}, artist={:?}, playing={}",
                metadata.title,
                metadata.artist,
                playback_state.playing
            );
            // Broadcast to WebSocket readers
            let now = chrono::Utc::now().timestamp();
            let netease = _state.ncm_np_service.get_now_playing().await;
            tokio::spawn(async move {
                broadcast_to_all_readers(
                    ServerToReaderMessage::OwnerMediaPlayback {
                        metadata,
                        playback_state,
                        netease,
                        updated_at: now,
                    },
                )
                .await;
            });
            Ok(None)
        }
        OwnerDesktopMessage::UploadArtwork {
            content_item_identifier,
            artwork_data,
            mime_type,
        } => {
            tracing::info!(
                "Received owner artwork upload (JSON): content_id={}, size={} bytes, mime={}",
                content_item_identifier,
                artwork_data.len(),
                mime_type
            );

            match handle_artwork_upload(&content_item_identifier, artwork_data, &mime_type).await {
                Ok(artwork_url) => Ok(Some(ServerToOwnerDesktopMessage::ArtworkUploaded {
                    content_item_identifier,
                    artwork_url,
                })),
                Err(e) => Err(e),
            }
        }
        OwnerDesktopMessage::UploadArtworkMeta {
            content_item_identifier,
            mime_type,
        } => {
            tracing::info!(
                "Received artwork upload meta: content_id={}, mime={}",
                content_item_identifier,
                mime_type
            );
            // Store metadata for next binary message (simplified for now)
            Ok(None)
        }
    }
}

/// Handle artwork upload
async fn handle_artwork_upload(
    content_item_identifier: &str,
    artwork_data: Vec<u8>,
    mime_type: &str,
) -> Result<String, String> {
    // Determine file extension from MIME type
    let ext = match mime_type {
        "image/jpeg" | "image/jpg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "jpg",
    };

    // Reject files larger than 10 MB
    const MAX_ARTWORK_SIZE: usize = 10 * 1024 * 1024;
    if artwork_data.len() > MAX_ARTWORK_SIZE {
        return Err(format!(
            "Artwork too large: {} bytes (max {} bytes)",
            artwork_data.len(),
            MAX_ARTWORK_SIZE
        ));
    }

    // Use hash of content_item_identifier as filename
    let mut hasher = DefaultHasher::new();
    content_item_identifier.hash(&mut hasher);
    let filename = format!("{:x}.{}", hasher.finish(), ext);

    // Ensure directory exists
    let artwork_dir = Path::new("./cache/artworks");
    if !artwork_dir.exists() {
        tokio::fs::create_dir_all(artwork_dir)
            .await
            .map_err(|e| format!("Failed to create artwork directory: {}", e))?;
    }

    let filepath = artwork_dir.join(&filename);

    // Save file using tokio::fs for async I/O
    tokio::fs::write(&filepath, &artwork_data)
        .await
        .map_err(|e| format!("Failed to save artwork file: {}", e))?;

    tracing::info!("Artwork saved: {}", filepath.display());

    // Generate full URL
    let backend_url =
        std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());
    let artwork_url = format!("{}/api/static/artworks/{}", backend_url, filename);

    Ok(artwork_url)
}
