//! Reader WebSocket endpoint
//!
//! Handles WebSocket connections from browser readers,
//! receiving owner desktop updates (window info, media playback).

use super::common::{
    ReaderConnection, broadcast_reading_list, broadcast_to_all_readers, generate_connection_id,
};
use crate::app::SharedState;
use crate::models::realtime::{ReaderInfo, ReaderToServerMessage, ServerToReaderMessage};
use axum::{
    extract::{
        Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
};
use futures::sink::SinkExt;
use serde::Deserialize;
use tokio::sync::mpsc;

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
    let connection_id = generate_connection_id();

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

    // Get reader registry
    use super::common::get_reader_registry;
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
    let welcome = ServerToReaderMessage::Welcome { online_count };
    if let Ok(json) = welcome.to_json() {
        let _ = socket.send(Message::Text(json.into())).await;
    }

    // 握手完成后立即推送当前 NetEase 播放状态（无需等待下次轮询）
    if let Some(netease_status) = state.ncm_np_service.get_now_playing().await {
        let now = chrono::Utc::now().timestamp();
        let msg = ServerToReaderMessage::OwnerMediaPlayback {
            metadata: crate::models::realtime::MediaMetadata {
                bundle_identifier: None,
                title: None,
                artist: None,
                album: None,
                duration: 0.0,
                artwork_url: None,
                content_item_identifier: None,
            },
            playback_state: crate::models::realtime::PlaybackState {
                playing: false,
                playback_rate: 1.0,
                elapsed_time: 0.0,
            },
            netease: Some(netease_status),
            updated_at: now,
        };
        if let Ok(json) = msg.to_json() {
            let _ = socket.send(Message::Text(json.into())).await;
        }
    }

    // Broadcast online count update to all readers
    broadcast_to_all_readers(ServerToReaderMessage::OnlineCountUpdate {
        count: online_count,
    })
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
                        if let Ok(json) = server_msg.to_json()
                            && socket.send(Message::Text(json.into())).await.is_err()
                        {
                            break;
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
        })
        .await;

        broadcast_reading_list(&registry_clone).await;

        tracing::info!(
            "Reader WebSocket disconnected | fingerprint: {} | connection_id: {} | online: {}",
            fingerprint_clone,
            connection_id_clone,
            online_count
        );
    }
}
