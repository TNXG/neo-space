//! Real-time communication data models

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ==================== Shared Types ====================

/// Window information
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub app_id: Option<String>,
    pub pid: u32,
}

/// Media metadata
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MediaMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bundle_identifier: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artist: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub album: Option<String>,
    pub duration: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artwork_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_item_identifier: Option<String>,
}

/// Playback state
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PlaybackState {
    pub playing: bool,
    pub playback_rate: f64,
    pub elapsed_time: f64,
}

// ==================== SSE Related ====================

/// Reader information
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReaderInfo {
    pub fingerprint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_title: Option<String>,
    pub connected_at: i64,
    pub last_heartbeat: i64,
}

/// Reading content item
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReadingItem {
    pub page_type: String,
    pub page_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_title: Option<String>,
    pub reader_count: usize,
}

/// Server-to-reader message (SSE)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerToReaderMessage {
    Pong,
    Welcome {
        online_count: usize,
    },
    OnlineCountUpdate {
        count: usize,
    },
    PageReaders {
        page_type: String,
        page_id: String,
        count: usize,
    },
    ReadingList {
        items: Vec<ReadingItem>,
    },
    OwnerWindowInfo {
        window_info: WindowInfo,
        updated_at: i64,
    },
    OwnerMediaPlayback {
        metadata: MediaMetadata,
        playback_state: PlaybackState,
        updated_at: i64,
    },
    Error {
        message: String,
    },
}

impl ServerToReaderMessage {
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    pub fn name(&self) -> &'static str {
        match self {
            Self::Pong => "pong",
            Self::Welcome { .. } => "welcome",
            Self::OnlineCountUpdate { .. } => "online_count_update",
            Self::PageReaders { .. } => "page_readers",
            Self::ReadingList { .. } => "reading_list",
            Self::OwnerWindowInfo { .. } => "owner_window_info",
            Self::OwnerMediaPlayback { .. } => "owner_media_playback",
            Self::Error { .. } => "error",
        }
    }
}

// ==================== WebSocket Related ====================

/// Reader-to-server message (WebSocket)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ReaderToServerMessage {
    Hello {
        fingerprint: String,
    },
}

/// Owner desktop client message
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OwnerDesktopMessage {
    WindowInfo {
        data: WindowInfo,
    },
    MediaPlayback {
        metadata: MediaMetadata,
        playback_state: PlaybackState,
    },
    UploadArtwork {
        content_item_identifier: String,
        artwork_data: Vec<u8>,
        mime_type: String,
    },
    UploadArtworkMeta {
        content_item_identifier: String,
        mime_type: String,
    },
}

/// Server-to-owner-desktop message
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerToOwnerDesktopMessage {
    Connected,
    ArtworkUploaded {
        content_item_identifier: String,
        artwork_url: String,
    },
    Error {
        message: String,
    },
}

impl ServerToOwnerDesktopMessage {
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}
