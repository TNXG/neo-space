//! Server-Sent Events for real-time reader updates
//!
//! Integrates with AppState's event_bus (broadcast channel) to push
//! real-time updates to connected readers. Maintains a reader registry
//! for tracking online users and broadcasting messages.

use crate::app::SharedState;
use crate::models::realtime::*;
use axum::{
    extract::{Query, State},
    response::sse::{Event, Sse},
};
use futures::stream::Stream;
use serde::Deserialize;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;

/// SSE query parameters
#[derive(Debug, Deserialize)]
pub struct SseQueryParams {
    #[serde(rename = "pageType")]
    pub page_type: Option<String>,
    #[serde(rename = "pageId")]
    pub page_id: Option<String>,
    #[serde(rename = "pageTitle")]
    pub page_title: Option<String>,
    pub fingerprint: Option<String>,
}

/// Reader connection entry in the registry
struct ReaderConnection {
    tx: mpsc::UnboundedSender<ServerToReaderMessage>,
    info: ReaderInfo,
}

/// Global reader registry (shared across all SSE connections)
type ReaderRegistry = Arc<RwLock<HashMap<String, ReaderConnection>>>;

/// Get or initialize the global reader registry
fn get_reader_registry() -> &'static ReaderRegistry {
    use std::sync::OnceLock;
    static REGISTRY: OnceLock<ReaderRegistry> = OnceLock::new();
    REGISTRY.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

/// Reader SSE endpoint - one-way push from server to readers
pub async fn reader_sse(
    State(state): State<SharedState>,
    Query(params): Query<SseQueryParams>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let client_id = format!("reader_sse_{}", Uuid::new_v4());
    let fingerprint = params
        .fingerprint
        .unwrap_or_else(|| format!("sse_{}", Uuid::new_v4()));

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

    // Register reader
    {
        let mut reg = registry.write().await;
        reg.insert(
            client_id.clone(),
            ReaderConnection {
                tx: tx.clone(),
                info: reader_info,
            },
        );
    }

    let online_count = {
        let reg = registry.read().await;
        reg.len()
    };

    tracing::info!(
        "Reader SSE connected | client_id: {} | fingerprint: {} | online: {}",
        client_id,
        fingerprint,
        online_count
    );

    // Broadcast online count update to all readers
    broadcast_to_all_readers(
        &registry,
        ServerToReaderMessage::OnlineCountUpdate {
            count: online_count,
        },
    )
    .await;

    // Broadcast reading list update
    broadcast_reading_list(&registry).await;

    // Subscribe to AppState event_bus for owner desktop updates
    let mut event_rx = state.event_bus.subscribe();

    let client_id_clone = client_id.clone();
    let fingerprint_clone = fingerprint.clone();
    let registry_clone = registry.clone();

    // Create stream that sends SSE events
    let stream = async_stream::stream! {
        // Send welcome message
        let welcome = ServerToReaderMessage::Welcome { online_count };
        if let Ok(json) = welcome.to_json() {
            yield Ok(Event::default().data(json).event(welcome.name()));
        }

        // Keep sending messages from the reader channel + event bus
        loop {
            tokio::select! {
                // Messages specifically for this reader (from registry broadcasts)
                msg = rx.recv() => {
                    match msg {
                        Some(server_msg) => {
                            if let Ok(json) = server_msg.to_json() {
                                yield Ok(Event::default().data(json).event(server_msg.name()));
                            }
                        }
                        None => break, // Channel closed
                    }
                }
                // Events from the global event bus (owner desktop updates, etc.)
                event = event_rx.recv() => {
                    match event {
                        Ok(bus_event) => {
                            if let Some(sse_msg) = convert_bus_event_to_sse(bus_event)
                                && let Ok(json) = sse_msg.to_json() {
                                    yield Ok(Event::default().data(json).event(sse_msg.name()));
                                }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            tracing::warn!("Reader {} lagged {} messages", client_id_clone, n);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            break;
                        }
                    }
                }
            }
        }

        // Unregister reader
        {
            let mut reg = registry_clone.write().await;
            reg.remove(&client_id_clone);
        }

        let online_count = {
            let reg = registry_clone.read().await;
            reg.len()
        };

        // Broadcast updated count
        broadcast_to_all_readers(&registry_clone, ServerToReaderMessage::OnlineCountUpdate {
            count: online_count,
        }).await;

        // Broadcast updated reading list
        broadcast_reading_list(&registry_clone).await;

        tracing::info!(
            "Reader SSE disconnected | client_id: {} | fingerprint: {} | online: {}",
            client_id_clone,
            fingerprint_clone,
            online_count
        );
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(30))
            .text("keepalive"),
    )
}

/// Broadcast a message to all connected readers via the registry
async fn broadcast_to_all_readers(registry: &ReaderRegistry, message: ServerToReaderMessage) {
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

/// Convert AppState event bus events to SSE messages for readers
fn convert_bus_event_to_sse(event: crate::app::Event) -> Option<ServerToReaderMessage> {
    match event {
        crate::app::Event::CommentCreated { id } => {
            tracing::debug!("New comment event for SSE: {}", id);
            None
        }
        _ => None,
    }
}

/// Broadcast a message to all connected readers (public helper for WS handler)
pub fn broadcast_owner_update(_state: &SharedState, message: ServerToReaderMessage) {
    let registry = get_reader_registry().clone();
    let msg = message;
    tokio::spawn(async move {
        broadcast_to_all_readers(&registry, msg).await;
    });
}
