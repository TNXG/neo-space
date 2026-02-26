//! 事件总线 - 用于广播消息到所有连接的客户端

use crate::models::realtime::{
    MediaMetadata, PlaybackState, ReaderInfo, ServerToReaderMessage, WindowInfo,
};
use moka::future::Cache;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, mpsc};

pub type ClientId = String;
pub type ReaderSender = mpsc::UnboundedSender<ServerToReaderMessage>;

/// 博主窗口状态
#[derive(Debug, Clone)]
pub struct OwnerWindowState {
    pub window_info: WindowInfo,
    pub updated_at: i64,
}

/// 博主媒体播放状态
#[derive(Debug, Clone)]
pub struct OwnerMediaState {
    pub metadata: MediaMetadata,
    pub playback_state: PlaybackState,
    pub updated_at: i64,
}

/// 事件总线 - 管理所有连接
#[derive(Clone)]
pub struct EventBus {
    /// 读者连接
    reader_clients: Arc<RwLock<HashMap<ClientId, (ReaderSender, ReaderInfo)>>>,
    /// 博主窗口状态缓存（3分钟过期）
    owner_window_cache: Cache<String, OwnerWindowState>,
    /// 博主媒体播放状态缓存（3分钟过期）
    owner_media_cache: Cache<String, OwnerMediaState>,
}

const CACHE_KEY: &str = "current";
const CACHE_TTL_SECS: u64 = 180; // 3分钟

impl EventBus {
    pub fn new() -> Self {
        Self {
            reader_clients: Arc::new(RwLock::new(HashMap::new())),
            owner_window_cache: Cache::builder()
                .time_to_live(Duration::from_secs(CACHE_TTL_SECS))
                .build(),
            owner_media_cache: Cache::builder()
                .time_to_live(Duration::from_secs(CACHE_TTL_SECS))
                .build(),
        }
    }

    /// 更新博主窗口信息
    pub async fn update_owner_window_info(&self, window_info: WindowInfo, updated_at: i64) {
        self.owner_window_cache
            .insert(
                CACHE_KEY.to_string(),
                OwnerWindowState {
                    window_info,
                    updated_at,
                },
            )
            .await;
    }

    /// 更新博主媒体播放状态
    pub async fn update_owner_media_playback(
        &self,
        metadata: MediaMetadata,
        playback_state: PlaybackState,
        updated_at: i64,
    ) {
        self.owner_media_cache
            .insert(
                CACHE_KEY.to_string(),
                OwnerMediaState {
                    metadata,
                    playback_state,
                    updated_at,
                },
            )
            .await;
    }

    /// 获取博主窗口状态（3分钟内有效）
    pub async fn get_owner_window_state(&self) -> Option<OwnerWindowState> {
        self.owner_window_cache.get(&CACHE_KEY.to_string()).await
    }

    /// 获取博主媒体播放状态（3分钟内有效）
    pub async fn get_owner_media_state(&self) -> Option<OwnerMediaState> {
        self.owner_media_cache.get(&CACHE_KEY.to_string()).await
    }

    /// 注册读者客户端
    pub async fn register_reader(
        &self,
        client_id: ClientId,
        sender: ReaderSender,
        info: ReaderInfo,
    ) {
        let mut clients = self.reader_clients.write().await;
        clients.insert(client_id, (sender, info));
    }

    /// 注销读者客户端
    pub async fn unregister_reader(&self, client_id: &str) {
        let mut clients = self.reader_clients.write().await;
        clients.remove(client_id);
    }

    /// 广播消息到所有读者
    pub async fn broadcast_to_readers(&self, message: ServerToReaderMessage) {
        let clients = self.reader_clients.read().await;
        for (sender, _) in clients.values() {
            let _ = sender.send(message.clone());
        }
    }

    /// 获取在线读者数量（按 fingerprint 去重）
    pub async fn reader_count(&self) -> usize {
        let clients = self.reader_clients.read().await;
        let unique: std::collections::HashSet<&str> = clients
            .values()
            .map(|(_, info)| info.fingerprint.as_str())
            .collect();
        unique.len()
    }

    /// 获取所有正在阅读的内容
    pub async fn get_reading_list(&self) -> Vec<(String, String, Option<String>, usize)> {
        let clients = self.reader_clients.read().await;
        let mut groups: HashMap<
            (String, String),
            (Option<String>, std::collections::HashSet<String>),
        > = HashMap::new();

        for (_, info) in clients.values() {
            if let (Some(pt), Some(pid)) = (&info.page_type, &info.page_id) {
                let entry = groups
                    .entry((pt.clone(), pid.clone()))
                    .or_insert((info.page_title.clone(), std::collections::HashSet::new()));
                entry.1.insert(info.fingerprint.clone());
            }
        }

        groups
            .into_iter()
            .map(|((pt, pid), (title, fps))| (pt, pid, title, fps.len()))
            .collect()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
