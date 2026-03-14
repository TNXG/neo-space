//! WebSocket for owner desktop client and reader real-time updates

use crate::app::SharedState;
use crate::models::realtime::{ReaderToServerMessage, *};
use axum::{
    extract::{
        Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures::sink::SinkExt;
use serde::Deserialize;
use std::collections::{HashMap, hash_map::DefaultHasher};
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;

/// WebSocket query parameters with token authentication (owner desktop)
#[derive(Debug, Deserialize)]
pub struct WsQueryParams {
    pub token: Option<String>,
}

/// WebSocket query parameters for readers (no authentication)
#[derive(Debug, Deserialize)]
pub struct ReaderWsQueryParams {
    #[serde(rename = "pageType")]
    pub page_type: Option<String>,
    #[serde(rename = "pageId")]
    pub page_id: Option<String>,
    #[serde(rename = "pageTitle")]
    pub page_title: Option<String>,
}

/// Unique connection ID to distinguish different connections
type ConnectionId = String;

/// Reader connection entry in the registry
struct ReaderConnection {
    tx: mpsc::UnboundedSender<ServerToReaderMessage>,
    info: ReaderInfo,
    connection_id: ConnectionId, // Unique ID for this specific connection
}

/// Global reader registry (fingerprint -> connection)
/// Ensures one connection per fingerprint (deduplicated)
type ReaderRegistry = Arc<RwLock<HashMap<String, ReaderConnection>>>;

/// Get or initialize the global reader registry
fn get_reader_registry() -> &'static ReaderRegistry {
    use std::sync::OnceLock;
    static REGISTRY: OnceLock<ReaderRegistry> = OnceLock::new();
    REGISTRY.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
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
                ).await;
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
            tokio::spawn(async move {
                broadcast_to_all_readers(
                    ServerToReaderMessage::OwnerMediaPlayback {
                        metadata,
                        playback_state,
                        updated_at: now,
                    },
                ).await;
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

/// Reader WebSocket endpoint - for browser readers without authentication
pub async fn reader_ws(
    State(state): State<SharedState>,
    ws: WebSocketUpgrade,
    Query(params): Query<ReaderWsQueryParams>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_reader_connection(socket, params, state))
}

/// Handle reader WebSocket connection
async fn handle_reader_connection(
    mut socket: WebSocket,
    params: ReaderWsQueryParams,
    state: SharedState,
) {
    // Unique ID for this specific connection
    let connection_id = Uuid::new_v4().to_string();

    // Wait for Hello message with fingerprint
    let fingerprint = loop {
        match socket.recv().await {
            Some(Ok(Message::Text(text))) => {
                match serde_json::from_str::<ReaderToServerMessage>(&text) {
                    Ok(ReaderToServerMessage::Hello { fingerprint }) => {
                        tracing::debug!(
                            "Received Hello from connection {} with fingerprint: {}",
                            connection_id,
                            fingerprint
                        );
                        break fingerprint;
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Failed to parse Hello message from {}: {}",
                            connection_id,
                            e
                        );
                        let _ = socket.send(Message::Text(
                            serde_json::json!({"type": "error", "message": "Invalid Hello message"})
                                .to_string()
                                .into(),
                        )).await;
                        let _ = socket.close().await;
                        return;
                    }
                }
            }
            Some(Ok(Message::Close(_))) => {
                tracing::debug!("Connection {} closed before sending Hello", connection_id);
                return;
            }
            Some(Ok(_)) => {}
            Some(Err(e)) => {
                tracing::error!("WebSocket error for {}: {}", connection_id, e);
                return;
            }
            None => return,
        }
    };

    // Create message channel for this reader
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerToReaderMessage>();

    // Create reader info
    let now = chrono::Utc::now().timestamp();
    let reader_info = ReaderInfo {
        fingerprint: fingerprint.clone(),
        page_type: params.page_type.clone(),
        page_id: params.page_id.clone(),
        page_title: params.page_title.clone(),
        connected_at: now,
        last_heartbeat: now,
    };

    let registry = get_reader_registry().clone();

    // Register reader with fingerprint as key (deduplication)
    let old_connection = {
        let mut reg = registry.write().await;
        reg.insert(
            fingerprint.clone(),
            ReaderConnection {
                tx: tx.clone(),
                info: reader_info,
                connection_id: connection_id.clone(),
            },
        )
    };

    // Close old connection if same fingerprint reconnected
    if let Some(old_conn) = old_connection {
        tracing::info!(
            "Replacing existing connection for fingerprint: {} (old: {}, new: {})",
            fingerprint,
            old_conn.connection_id,
            connection_id
        );
        drop(old_conn.tx);
    }

    let online_count = {
        let reg = registry.read().await;
        reg.len()
    };

    tracing::info!(
        "Reader WebSocket connected | fingerprint: {} | connection_id: {} | page_type: {:?} | page_id: {:?} | online: {}",
        fingerprint,
        connection_id,
        params.page_type,
        params.page_id,
        online_count
    );

    // Send welcome message
    let welcome = ServerToReaderMessage::Welcome {
        online_count,
    };
    if let Ok(json) = welcome.to_json() {
        let _ = socket.send(Message::Text(json.into())).await;
    }

    // Broadcast online count update to all readers
    broadcast_to_all_readers(
        ServerToReaderMessage::OnlineCountUpdate {
            count: online_count,
        },
    )
    .await;

    // Broadcast reading list update
    broadcast_reading_list(&registry).await;

    // Subscribe to AppState event_bus for owner desktop updates
    let mut event_rx = state.event_bus.subscribe();

    let fingerprint_clone = fingerprint.clone();
    let connection_id_clone = connection_id.clone();
    let registry_clone = registry.clone();

    // Handle messages loop
    loop {
        tokio::select! {
            // Messages specifically for this reader (from registry broadcasts)
            msg = rx.recv() => {
                match msg {
                    Some(server_msg) => {
                        if let Ok(json) = server_msg.to_json() {
                            if socket.send(Message::Text(json.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    None => break, // Channel closed (connection was replaced)
                }
            }
            // Events from the global event bus
            event = event_rx.recv() => {
                match event {
                    Ok(_bus_event) => {}
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!("Reader {} lagged {} messages", fingerprint_clone, n);
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                        break;
                    }
                }
            }
            // WebSocket messages from client
            ws_result = socket.recv() => {
                match ws_result {
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("Reader {} ({}) closed connection", fingerprint_clone, connection_id_clone);
                        break;
                    }
                    Some(Ok(Message::Ping(data))) => {
                        let _ = socket.send(Message::Pong(data)).await;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(e)) => {
                        tracing::error!("WebSocket error for {} ({}): {}", fingerprint_clone, connection_id_clone, e);
                        break;
                    }
                    None => break,
                }
            }
        }
    }

    // Unregister reader - only if still the current connection for this fingerprint
    let was_current = {
        let mut reg = registry_clone.write().await;
        if let Some(conn) = reg.get(&fingerprint_clone) {
            if conn.connection_id == connection_id_clone {
                reg.remove(&fingerprint_clone);
                true
            } else {
                false
            }
        } else {
            false
        }
    };

    if was_current {
        let online_count = {
            let reg = registry_clone.read().await;
            reg.len()
        };

        broadcast_to_all_readers(ServerToReaderMessage::OnlineCountUpdate {
            count: online_count,
        }).await;

        broadcast_reading_list(&registry_clone).await;

        tracing::info!(
            "Reader WebSocket disconnected | fingerprint: {} | connection_id: {} | online: {}",
            fingerprint_clone,
            connection_id_clone,
            online_count
        );
    }
}

/// Broadcast a message to all connected readers via the registry
async fn broadcast_to_all_readers(message: ServerToReaderMessage) {
    let registry = get_reader_registry().clone();
    let reg = registry.read().await;
    for (_id, conn) in reg.iter() {
        let _ = conn.tx.send(message.clone());
    }
}

/// Build and broadcast the current reading list
async fn broadcast_reading_list(registry: &ReaderRegistry) {
    let reg = registry.read().await;

    // Aggregate readers by page
    let mut page_counts: HashMap<(String, String, Option<String>), usize> = HashMap::new();
    for conn in reg.values() {
        if let (Some(page_type), Some(page_id)) = (&conn.info.page_type, &conn.info.page_id) {
            let key = (
                page_type.clone(),
                page_id.clone(),
                conn.info.page_title.clone(),
            );
            *page_counts.entry(key).or_insert(0) += 1;
        }
    }

    let items: Vec<ReadingItem> = page_counts
        .into_iter()
        .map(
            |((page_type, page_id, page_title), reader_count)| ReadingItem {
                page_type,
                page_id,
                page_title,
                reader_count,
            },
        )
        .collect();

    let msg = ServerToReaderMessage::ReadingList { items };
    for conn in reg.values() {
        let _ = conn.tx.send(msg.clone());
    }
}
