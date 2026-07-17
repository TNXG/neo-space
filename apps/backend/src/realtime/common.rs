//! Common utilities for WebSocket handlers

use crate::models::realtime::{ReadingItem, ServerToReaderMessage};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};
use uuid::Uuid;

/// Unique connection ID to distinguish different connections
pub type ConnectionId = String;

/// Reader connection entry in the registry
pub struct ReaderConnection {
    pub tx: mpsc::UnboundedSender<ServerToReaderMessage>,
    pub info: crate::models::realtime::ReaderInfo,
    pub connection_id: ConnectionId,
}

/// Global reader registry (fingerprint -> connection)
/// Ensures one connection per fingerprint (deduplicated)
pub type ReaderRegistry = Arc<RwLock<HashMap<String, ReaderConnection>>>;

/// Get or initialize the global reader registry
pub fn get_reader_registry() -> &'static ReaderRegistry {
    use std::sync::OnceLock;
    static REGISTRY: OnceLock<ReaderRegistry> = OnceLock::new();
    REGISTRY.get_or_init(|| Arc::new(RwLock::new(HashMap::new())))
}

/// Generate a new unique connection ID
pub fn generate_connection_id() -> ConnectionId {
    Uuid::new_v4().to_string()
}

/// Broadcast a message to all connected readers via the registry
pub async fn broadcast_to_all_readers(message: ServerToReaderMessage) {
    let registry = get_reader_registry().clone();
    let reg = registry.read().await;
    for conn in reg.values() {
        let _ = conn.tx.send(message.clone());
    }
}

/// Build and broadcast the current reading list
pub async fn broadcast_reading_list(registry: &ReaderRegistry) {
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
