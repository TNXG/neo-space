//! 事件总线 - 用于广播消息到所有连接的客户端

use crate::models::realtime::{ReaderInfo, ServerToReaderMessage};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};

pub type ClientId = String;
pub type ReaderSender = mpsc::UnboundedSender<ServerToReaderMessage>;

/// 事件总线 - 管理所有 WebSocket 连接
#[derive(Clone)]
pub struct EventBus {
    /// 读者连接
    reader_clients: Arc<RwLock<HashMap<ClientId, (ReaderSender, ReaderInfo)>>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            reader_clients: Arc::new(RwLock::new(HashMap::new())),
        }
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

    /// 更新读者信息
    pub async fn update_reader_info(&self, client_id: &str, info: ReaderInfo) {
        let mut clients = self.reader_clients.write().await;
        if let Some((sender, _)) = clients.get(client_id) {
            let sender = sender.clone();
            clients.insert(client_id.to_string(), (sender, info));
        }
    }

    /// 广播消息到所有读者
    pub async fn broadcast_to_readers(&self, message: ServerToReaderMessage) {
        let clients = self.reader_clients.read().await;
        for (sender, _) in clients.values() {
            let _ = sender.send(message.clone());
        }
    }

    /// 发送消息到特定读者
    pub async fn send_to_reader(
        &self,
        client_id: &str,
        message: ServerToReaderMessage,
    ) -> Result<(), String> {
        let clients = self.reader_clients.read().await;
        if let Some((sender, _)) = clients.get(client_id) {
            sender.send(message).map_err(|e| format!("发送失败: {e}"))?;
            Ok(())
        } else {
            Err("读者客户端不存在".to_string())
        }
    }

    /// 获取在线读者数量（按 fingerprint 去重）
    pub async fn reader_count(&self) -> usize {
        let clients = self.reader_clients.read().await;
        log::debug!("reader_count: 当前连接数 {}", clients.len());
        for (client_id, (_, info)) in clients.iter() {
            log::debug!(
                "  - client_id: {}, fingerprint: {}",
                client_id,
                info.fingerprint
            );
        }
        let unique_fingerprints: std::collections::HashSet<&str> = clients
            .values()
            .map(|(_, info)| info.fingerprint.as_str())
            .collect();
        log::debug!("reader_count: 去重后人数 {}", unique_fingerprints.len());
        unique_fingerprints.len()
    }

    /// 获取所有读者信息
    pub async fn get_all_readers(&self) -> Vec<ReaderInfo> {
        let clients = self.reader_clients.read().await;
        clients.values().map(|(_, info)| info.clone()).collect()
    }

    /// 获取特定页面的读者数量（按 fingerprint 去重）
    pub async fn get_page_reader_count(&self, page_type: &str, page_id: &str) -> usize {
        let clients = self.reader_clients.read().await;
        let unique_fingerprints: std::collections::HashSet<&str> = clients
            .values()
            .filter(|(_, info)| {
                info.page_type.as_deref() == Some(page_type)
                    && info.page_id.as_deref() == Some(page_id)
            })
            .map(|(_, info)| info.fingerprint.as_str())
            .collect();
        unique_fingerprints.len()
    }

    /// 获取所有正在阅读的内容（按页面分组，按 fingerprint 去重）
    pub async fn get_reading_list(&self) -> Vec<(String, String, Option<String>, usize)> {
        let clients = self.reader_clients.read().await;
        // 先按页面分组收集 fingerprint
        let mut page_fingerprints: HashMap<
            (String, String),
            (Option<String>, std::collections::HashSet<String>),
        > = HashMap::new();

        for (_, info) in clients.values() {
            if let (Some(page_type), Some(page_id)) = (&info.page_type, &info.page_id) {
                let key = (page_type.clone(), page_id.clone());
                let entry = page_fingerprints
                    .entry(key)
                    .or_insert((info.page_title.clone(), std::collections::HashSet::new()));
                entry.1.insert(info.fingerprint.clone());
            }
        }

        page_fingerprints
            .into_iter()
            .map(|((page_type, page_id), (page_title, fingerprints))| {
                (page_type, page_id, page_title, fingerprints.len())
            })
            .collect()
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
