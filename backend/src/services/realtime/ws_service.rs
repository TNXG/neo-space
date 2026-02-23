//! WebSocket 服务
//! 用于博主桌面客户端的双向通信

use chrono::Utc;
use futures::{SinkExt, StreamExt};
use rocket_ws::frame::{CloseCode, CloseFrame};
use rocket_ws::{stream::DuplexStream, Message};

use crate::models::realtime::{
    OwnerDesktopMessage, ServerToOwnerDesktopMessage, ServerToReaderMessage,
};
use crate::websocket::event_bus::EventBus;

pub struct OwnerWebSocketService;

impl OwnerWebSocketService {
    /// 验证 token
    pub fn verify_token(token: Option<String>) -> Result<(), String> {
        let expected_token = std::env::var("OWNER_DESKTOP_TOKEN")
            .map_err(|_| "服务器配置错误：未设置 OWNER_DESKTOP_TOKEN".to_string())?;

        if token.as_ref() != Some(&expected_token) {
            return Err("认证失败：token 无效".to_string());
        }

        Ok(())
    }

    /// 处理 WebSocket 连接
    pub async fn handle_connection(
        mut stream: DuplexStream,
        event_bus: EventBus,
        token: Option<String>,
    ) -> Result<(), rocket_ws::result::Error> {
        // 验证 token
        if let Err(error_msg) = Self::verify_token(token) {
            log::warn!("博主桌面客户端 WebSocket 认证失败: {error_msg}");

            let error = ServerToOwnerDesktopMessage::Error {
                message: error_msg.clone(),
            };
            if let Ok(json) = error.to_json() {
                let _ = stream.send(Message::Text(json)).await;
            }

            let reason = if error_msg.contains("配置错误") {
                "服务器配置错误"
            } else {
                "认证失败"
            };

            let _ = stream
                .close(Some(CloseFrame {
                    code: CloseCode::Policy,
                    reason: reason.into(),
                }))
                .await;

            return Ok(());
        }

        log::info!("博主桌面客户端 WebSocket 认证成功，已连接");

        // 发送连接成功消息
        let connected_msg = ServerToOwnerDesktopMessage::Connected;
        if let Ok(json) = connected_msg.to_json() {
            let _ = stream.send(Message::Text(json)).await;
        }

        // 用于存储待处理的封面上传元数据
        let mut pending_artwork: Option<(String, String)> = None;

        // 处理消息循环
        loop {
            match stream.next().await {
                Some(Ok(Message::Text(text))) => {
                    match Self::handle_message(&text, &event_bus, &mut pending_artwork).await {
                        Ok(Some(response)) => {
                            if let Ok(json) = response.to_json() {
                                let _ = stream.send(Message::Text(json)).await;
                            }
                        }
                        Ok(None) => {}
                        Err(e) => {
                            log::error!("处理博主桌面客户端消息失败: {e}");
                            let error_msg = ServerToOwnerDesktopMessage::Error { message: e };
                            if let Ok(json) = error_msg.to_json() {
                                let _ = stream.send(Message::Text(json)).await;
                            }
                        }
                    }
                }
                Some(Ok(Message::Binary(data))) => {
                    if let Some((content_item_identifier, mime_type)) = pending_artwork.take() {
                        match Self::handle_artwork_upload(
                            &content_item_identifier,
                            data,
                            &mime_type,
                        )
                        .await
                        {
                            Ok(artwork_url) => {
                                let response = ServerToOwnerDesktopMessage::ArtworkUploaded {
                                    content_item_identifier,
                                    artwork_url,
                                };
                                if let Ok(json) = response.to_json() {
                                    let _ = stream.send(Message::Text(json)).await;
                                }
                            }
                            Err(e) => {
                                log::error!("处理封面上传失败: {e}");
                                let error_msg = ServerToOwnerDesktopMessage::Error { message: e };
                                if let Ok(json) = error_msg.to_json() {
                                    let _ = stream.send(Message::Text(json)).await;
                                }
                            }
                        }
                    } else {
                        log::warn!("收到二进制消息但没有待处理的封面元数据");
                    }
                }
                Some(Ok(Message::Close(_))) => {
                    log::info!("博主桌面客户端关闭连接");
                    break;
                }
                Some(Ok(Message::Ping(_))) => {
                    let _ = stream.send(Message::Pong(vec![])).await;
                }
                Some(Err(e)) => {
                    log::error!("WebSocket 错误: {e}");
                    break;
                }
                None => break,
                _ => {}
            }
        }

        log::info!("博主桌面客户端已断开连接");
        Ok(())
    }

    /// 处理博主桌面客户端消息
    async fn handle_message(
        text: &str,
        event_bus: &EventBus,
        pending_artwork: &mut Option<(String, String)>,
    ) -> Result<Option<ServerToOwnerDesktopMessage>, String> {
        let desktop_msg: OwnerDesktopMessage =
            serde_json::from_str(text).map_err(|e| format!("解析消息失败: {e}"))?;

        match desktop_msg {
            OwnerDesktopMessage::WindowInfo { data } => {
                log::info!(
                    "收到博主窗口信息: title={}, process={}, app_id={:?}",
                    data.title,
                    data.process_name,
                    data.app_id
                );

                let now = Utc::now().timestamp();

                // 更新 EventBus 中的状态
                event_bus.update_owner_window_info(data.clone(), now).await;

                // 广播窗口信息到所有读者
                let msg = ServerToReaderMessage::OwnerWindowInfo {
                    window_info: data,
                    updated_at: now,
                };
                event_bus.broadcast_to_readers(msg).await;

                Ok(None)
            }
            OwnerDesktopMessage::MediaPlayback {
                metadata,
                playback_state,
            } => {
                log::info!(
                    "收到博主媒体播放状态: title={:?}, artist={:?}, playing={}",
                    metadata.title,
                    metadata.artist,
                    playback_state.playing
                );

                let now = Utc::now().timestamp();

                // 更新 EventBus 中的状态
                event_bus
                    .update_owner_media_playback(metadata.clone(), playback_state.clone(), now)
                    .await;

                // 广播媒体播放状态到所有读者
                let msg = ServerToReaderMessage::OwnerMediaPlayback {
                    metadata,
                    playback_state,
                    updated_at: now,
                };
                event_bus.broadcast_to_readers(msg).await;

                Ok(None)
            }
            OwnerDesktopMessage::UploadArtwork {
                content_item_identifier,
                artwork_data,
                mime_type,
            } => {
                log::info!(
                    "收到博主媒体封面上传（JSON）: content_id={}, size={} bytes, mime={}",
                    content_item_identifier,
                    artwork_data.len(),
                    mime_type
                );

                match Self::handle_artwork_upload(
                    &content_item_identifier,
                    artwork_data,
                    &mime_type,
                )
                .await
                {
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
                log::info!(
                    "收到封面上传元数据: content_id={content_item_identifier}, mime={mime_type}"
                );
                *pending_artwork = Some((content_item_identifier, mime_type));
                Ok(None)
            }
        }
    }

    /// 处理封面上传
    async fn handle_artwork_upload(
        content_item_identifier: &str,
        artwork_data: Vec<u8>,
        mime_type: &str,
    ) -> Result<String, String> {
        // 根据 MIME 类型确定文件扩展名
        let ext = match mime_type {
            "image/jpeg" | "image/jpg" => "jpg",
            "image/png" => "png",
            "image/webp" => "webp",
            "image/gif" => "gif",
            _ => "jpg",
        };

        // 使用 content_item_identifier 的 hash 作为文件名
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        content_item_identifier.hash(&mut hasher);
        let filename = format!("{:x}.{}", hasher.finish(), ext);

        // 确保目录存在
        let artwork_dir = std::path::Path::new("./cache/artworks");
        if !artwork_dir.exists() {
            std::fs::create_dir_all(artwork_dir).map_err(|e| format!("创建封面目录失败: {e}"))?;
        }

        let filepath = artwork_dir.join(&filename);

        // 保存文件
        std::fs::write(&filepath, &artwork_data).map_err(|e| format!("保存封面文件失败: {e}"))?;

        log::info!("封面已保存: {}", filepath.display());

        // 生成完整 URL
        let backend_url =
            std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://localhost:8000".to_string());
        let artwork_url = format!("{backend_url}/api/static/artworks/{filename}");

        Ok(artwork_url)
    }
}
