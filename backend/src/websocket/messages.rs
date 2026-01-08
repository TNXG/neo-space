//! WebSocket 消息类型

use serde::{Deserialize, Serialize};

/// 博主桌面客户端消息（来自桌面窗口与媒体信息上传工具）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OwnerDesktopMessage {
    /// 窗口信息更新
    WindowInfo {
        data: WindowInfo,
    },
    /// 媒体播放状态更新
    MediaPlayback {
        metadata: MediaMetadata,
        playback_state: PlaybackState,
    },
    /// 上传媒体封面（JSON 中包含二进制数据，不推荐）
    UploadArtwork {
        /// 内容标识符（用于关联媒体）
        content_item_identifier: String,
        /// 图片数据（字节数组）
        artwork_data: Vec<u8>,
        /// MIME 类型
        mime_type: String,
    },
    /// 上传媒体封面元数据（推荐：先发送此消息，再发送二进制帧）
    UploadArtworkMeta {
        /// 内容标识符（用于关联媒体）
        content_item_identifier: String,
        /// MIME 类型
        mime_type: String,
    },
}

/// 窗口信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub title: String,
    pub process_name: String,
    /// 图标 URL（由服务器生成）
    pub icon_url: Option<String>,
    pub app_id: Option<String>,
    pub pid: u32,
}

/// 媒体元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaMetadata {
    /// 应用 Bundle ID
    pub bundle_identifier: Option<String>,
    /// 曲目标题
    pub title: Option<String>,
    /// 艺术家
    pub artist: Option<String>,
    /// 专辑
    pub album: Option<String>,
    /// 总时长（秒）
    pub duration: f64,
    /// 封面 URL（由后端生成）
    pub artwork_url: Option<String>,
    /// 内容标识符
    pub content_item_identifier: Option<String>,
}

/// 播放状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaybackState {
    /// 是否正在播放
    pub playing: bool,
    /// 播放速率 (1.0 = 正常速度)
    pub playback_rate: f64,
    /// 已播放时长（秒）
    pub elapsed_time: f64,
}

/// 读者发送的消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ReaderMessage {
    /// Ping 消息
    Ping,
    /// 进入页面
    EnterPage {
        page_type: String,  // "post", "note", "page"
        page_id: String,
        page_title: Option<String>,
    },
    /// 离开页面
    LeavePage,
    /// 心跳（保持在线状态）
    Heartbeat,
}

/// 服务器发送给读者的消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerToReaderMessage {
    /// Pong 消息
    Pong,
    /// 欢迎消息
    Welcome {
        online_count: usize,
    },
    /// 在线人数更新
    OnlineCountUpdate {
        count: usize,
    },
    /// 当前页面阅读人数
    PageReaders {
        page_type: String,
        page_id: String,
        count: usize,
    },
    /// 其他读者正在阅读的内容
    ReadingList {
        items: Vec<ReadingItem>,
    },
    /// 博主窗口信息更新（来自桌面客户端上报）
    OwnerWindowInfo {
        window_info: WindowInfo,
        updated_at: i64,
    },
    /// 博主媒体播放状态更新（来自桌面客户端上报）
    OwnerMediaPlayback {
        metadata: MediaMetadata,
        playback_state: PlaybackState,
        updated_at: i64,
    },
    /// 错误消息
    Error { message: String },
}

/// 服务器发送给博主桌面客户端的消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerToOwnerDesktopMessage {
    /// 连接成功
    Connected,
    /// 封面上传成功
    ArtworkUploaded {
        content_item_identifier: String,
        artwork_url: String,
    },
    /// 错误消息
    Error { message: String },
}

/// 正在阅读的内容项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadingItem {
    pub page_type: String,
    pub page_id: String,
    pub page_title: Option<String>,
    pub reader_count: usize,
}

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

impl ServerToReaderMessage {
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}

impl ServerToOwnerDesktopMessage {
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }
}
