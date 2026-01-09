//! 实时通信相关的数据模型

use serde::{Deserialize, Serialize};

// ==================== 共享类型 ====================

/// 窗口信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
    pub icon_url: Option<String>,
    pub app_id: Option<String>,
    pub pid: u32,
}

/// 媒体元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaMetadata {
    pub bundle_identifier: Option<String>,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub duration: f64,
    pub artwork_url: Option<String>,
    pub content_item_identifier: Option<String>,
}

/// 播放状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackState {
    pub playing: bool,
    pub playback_rate: f64,
    pub elapsed_time: f64,
}

// ==================== SSE 相关 ====================

/// 读者信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReaderInfo {
    pub fingerprint: String,
    pub page_type: Option<String>,
    pub page_id: Option<String>,
    pub page_title: Option<String>,
    pub connected_at: i64,
    pub last_heartbeat: i64,
}

/// 正在阅读的内容项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingItem {
    pub page_type: String,
    pub page_id: String,
    pub page_title: Option<String>,
    pub reader_count: usize,
}

/// 服务器发送给读者的消息（SSE）
#[derive(Debug, Clone, Serialize, Deserialize)]
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
}

/// 博主桌面客户端消息
#[derive(Debug, Clone, Serialize, Deserialize)]
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

/// 服务器发送给博主桌面客户端的消息
#[derive(Debug, Clone, Serialize, Deserialize)]
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
