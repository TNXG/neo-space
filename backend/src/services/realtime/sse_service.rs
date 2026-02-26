//! SSE (Server-Sent Events) 服务
//! 用于向前端推送实时状态更新

use chrono::Utc;
use rocket::response::stream::{Event, EventStream};
use tokio::sync::mpsc;
use tokio_stream::StreamExt as TokioStreamExt;
use tokio_stream::wrappers::UnboundedReceiverStream;
use uuid::Uuid;

use crate::models::realtime::{ReaderInfo, ReadingItem, ServerToReaderMessage};
use crate::websocket::event_bus::EventBus;

pub struct ReaderSSEService;

impl ReaderSSEService {
    /// 创建 SSE 流
    pub fn create_stream(
        event_bus: EventBus,
        page_type: Option<String>,
        page_id: Option<String>,
        page_title: Option<String>,
        fingerprint: Option<String>,
    ) -> EventStream![] {
        EventStream! {
            let client_id = format!("reader_sse_{}", Uuid::new_v4());
            // 使用前端传来的 fingerprint，如果没有则生成一个（兜底）
            let fingerprint = fingerprint.unwrap_or_else(|| format!("sse_{}", Uuid::new_v4()));

            // 创建消息通道
            let (tx, rx) = mpsc::unbounded_channel::<ServerToReaderMessage>();

            // 创建读者信息（从 URL 参数获取页面信息）
            let now = Utc::now().timestamp();
            let reader_info = ReaderInfo {
                fingerprint: fingerprint.clone(),
                page_type,
                page_id,
                page_title,
                connected_at: now,
                last_heartbeat: now,
            };

            // 注册读者到事件总线
            event_bus.register_reader(client_id.clone(), tx, reader_info).await;

            // 获取当前在线人数
            let online_count = event_bus.reader_count().await;

            log::info!(
                "读者 SSE 已连接 | client_id: {} | fingerprint: {} | 在线人数: {}",
                client_id,
                fingerprint,
                online_count
            );

            // 发送欢迎消息
            let welcome = ServerToReaderMessage::Welcome { online_count };
            yield Event::json(&welcome);

            // 发送博主当前状态（如果3分钟内有效）
            if let Some(window_state) = event_bus.get_owner_window_state().await {
                let msg = ServerToReaderMessage::OwnerWindowInfo {
                    window_info: window_state.window_info,
                    updated_at: window_state.updated_at,
                };
                yield Event::json(&msg);
            }
            if let Some(media_state) = event_bus.get_owner_media_state().await {
                let msg = ServerToReaderMessage::OwnerMediaPlayback {
                    metadata: media_state.metadata,
                    playback_state: media_state.playback_state,
                    updated_at: media_state.updated_at,
                };
                yield Event::json(&msg);
            }

            // 通知所有读者在线人数更新
            let count_update = ServerToReaderMessage::OnlineCountUpdate {
                count: online_count,
            };
            event_bus.broadcast_to_readers(count_update).await;

            // 广播当前阅读列表
            Self::broadcast_reading_list(&event_bus).await;

            // 将 receiver 转换为 stream 并持续推送消息
            let mut stream = UnboundedReceiverStream::new(rx);

            while let Some(server_msg) = stream.next().await {
                yield Event::json(&server_msg);
            }

            // 注销读者
            event_bus.unregister_reader(&client_id).await;

            // 更新在线人数
            let online_count = event_bus.reader_count().await;
            let count_update = ServerToReaderMessage::OnlineCountUpdate {
                count: online_count,
            };
            event_bus.broadcast_to_readers(count_update).await;

            // 广播更新后的阅读列表
            Self::broadcast_reading_list(&event_bus).await;

            log::info!(
                "读者 SSE 已断开 | client_id: {} | fingerprint: {} | 在线人数: {}",
                client_id,
                fingerprint,
                online_count
            );
        }
    }

    /// 广播当前阅读列表给所有读者
    async fn broadcast_reading_list(event_bus: &EventBus) {
        let reading_list = event_bus.get_reading_list().await;
        let items: Vec<ReadingItem> = reading_list
            .into_iter()
            .map(
                |(page_type, page_id, page_title, reader_count)| ReadingItem {
                    page_type,
                    page_id,
                    page_title,
                    reader_count,
                },
            )
            .collect();

        let msg = ServerToReaderMessage::ReadingList { items };
        event_bus.broadcast_to_readers(msg).await;
    }
}
