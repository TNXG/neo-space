//! WebSocket 处理器

use rocket::State;
use rocket_ws::{Channel, Message, WebSocket};
use rocket_ws::frame::{CloseCode, CloseFrame};
use tokio::sync::mpsc;
use futures::{SinkExt, StreamExt};
use chrono::Utc;
use uuid::Uuid;

use crate::websocket::event_bus::EventBus;
use crate::websocket::messages::{
    ReaderMessage, ServerToReaderMessage, ReaderInfo, ReadingItem,
    OwnerDesktopMessage, ServerToOwnerDesktopMessage,
};

/// 读者 WebSocket 端点（不需要鉴权，握手后发送 Fingerprint）
#[get("/reader")]
pub fn reader_ws(
    ws: WebSocket,
    event_bus: &State<EventBus>,
) -> Channel<'static> {
    let event_bus = event_bus.inner().clone();
    
    ws.channel(move |stream| {
        Box::pin(handle_reader_connection(stream, event_bus))
    })
}

/// 处理读者 WebSocket 连接
async fn handle_reader_connection(
    mut stream: rocket_ws::stream::DuplexStream,
    event_bus: EventBus,
) -> Result<(), rocket_ws::result::Error> {
    log::info!("新的读者 WebSocket 连接");
    
    // 等待客户端发送 Fingerprint
    let fingerprint = match stream.next().await {
        Some(Ok(Message::Text(text))) => {
            log::info!("收到首次消息: {}", text);
            match serde_json::from_str::<serde_json::Value>(&text) {
                Ok(json) => {
                    log::info!("解析 JSON 成功: {:?}", json);
                    if let Some(fp) = json.get("fingerprint").and_then(|v| v.as_str()) {
                        log::info!("提取 fingerprint 成功: {}", fp);
                        fp.to_string()
                    } else {
                        log::warn!("首次消息缺少 fingerprint，使用默认值");
                        format!("unknown_{}", Utc::now().timestamp())
                    }
                }
                Err(e) => {
                    log::warn!("首次消息解析失败: {}, 使用默认值", e);
                    format!("unknown_{}", Utc::now().timestamp())
                }
            }
        }
        _ => {
            log::warn!("未收到首次消息，关闭连接");
            return Ok(());
        }
    };
    
    let client_id = format!("reader_{}_{}", fingerprint, Uuid::new_v4());
    
    // 创建消息通道
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerToReaderMessage>();
    
    // 创建读者信息
    let now = Utc::now().timestamp();
    let reader_info = ReaderInfo {
        fingerprint: fingerprint.clone(),
        page_type: None,
        page_id: None,
        page_title: None,
        connected_at: now,
        last_heartbeat: now,
    };
    
    // 注册读者到事件总线
    event_bus.register_reader(client_id.clone(), tx, reader_info).await;
    
    log::info!("读者已连接，Fingerprint: {}", fingerprint);
    
    // 获取当前在线人数
    let online_count = event_bus.reader_count().await;
    
    // 发送欢迎消息
    let welcome = ServerToReaderMessage::Welcome { online_count };
    
    if let Ok(json) = welcome.to_json() {
        let _ = stream.send(Message::Text(json)).await;
    }
    
    // 通知所有读者在线人数更新
    let count_update = ServerToReaderMessage::OnlineCountUpdate {
        count: online_count,
    };
    event_bus.broadcast_to_readers(count_update).await;
    
    // 处理消息循环
    loop {
        tokio::select! {
            // 接收读者消息
            Some(msg) = stream.next() => {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Err(e) = handle_reader_message(&text, &client_id, &fingerprint, &event_bus).await {
                            log::error!("处理读者消息失败: {}", e);
                            let error_msg = ServerToReaderMessage::Error {
                                message: e,
                            };
                            if let Ok(json) = error_msg.to_json() {
                                let _ = stream.send(Message::Text(json)).await;
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        log::info!("读者 {} 关闭连接", client_id);
                        break;
                    }
                    Ok(Message::Ping(_)) => {
                        let _ = stream.send(Message::Pong(vec![])).await;
                    }
                    Err(e) => {
                        log::error!("WebSocket 错误: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
            // 发送服务器消息
            Some(server_msg) = rx.recv() => {
                if let Ok(json) = server_msg.to_json() {
                    if stream.send(Message::Text(json)).await.is_err() {
                        break;
                    }
                }
            }
            else => break,
        }
    }
    
    // 注销读者
    event_bus.unregister_reader(&client_id).await;
    
    // 更新在线人数
    let online_count = event_bus.reader_count().await;
    let count_update = ServerToReaderMessage::OnlineCountUpdate {
        count: online_count,
    };
    event_bus.broadcast_to_readers(count_update).await;
    
    log::info!("读者已断开连接（Fingerprint: {}）", fingerprint);
    
    Ok(())
}

/// 处理读者消息
async fn handle_reader_message(
    text: &str,
    client_id: &str,
    fingerprint: &str,
    event_bus: &EventBus,
) -> Result<(), String> {
    let reader_msg: ReaderMessage = serde_json::from_str(text)
        .map_err(|e| format!("解析消息失败: {}", e))?;
    
    match reader_msg {
        ReaderMessage::Ping => {
            let pong = ServerToReaderMessage::Pong;
            event_bus.send_to_reader(client_id, pong).await?;
        }
        ReaderMessage::EnterPage { page_type, page_id, page_title } => {
            log::info!(
                "读者 {} 进入页面: type={}, id={}, title={:?}",
                fingerprint, page_type, page_id, page_title
            );
            
            // 更新读者信息
            let now = Utc::now().timestamp();
            let reader_info = ReaderInfo {
                fingerprint: fingerprint.to_string(),
                page_type: Some(page_type.clone()),
                page_id: Some(page_id.clone()),
                page_title: page_title.clone(),
                connected_at: now,
                last_heartbeat: now,
            };
            event_bus.update_reader_info(client_id, reader_info).await;
            
            // 获取当前页面的读者数量
            let page_reader_count = event_bus.get_page_reader_count(&page_type, &page_id).await;
            
            // 发送当前页面阅读人数
            let page_readers_msg = ServerToReaderMessage::PageReaders {
                page_type: page_type.clone(),
                page_id: page_id.clone(),
                count: page_reader_count,
            };
            event_bus.send_to_reader(client_id, page_readers_msg).await?;
            
            // 广播更新后的阅读列表给所有读者
            broadcast_reading_list(&event_bus).await;
        }
        ReaderMessage::LeavePage => {
            log::info!("读者 {} 离开页面", fingerprint);
            
            // 更新读者信息（清除页面信息）
            let now = Utc::now().timestamp();
            let reader_info = ReaderInfo {
                fingerprint: fingerprint.to_string(),
                page_type: None,
                page_id: None,
                page_title: None,
                connected_at: now,
                last_heartbeat: now,
            };
            event_bus.update_reader_info(client_id, reader_info).await;
            
            // 广播更新后的阅读列表
            broadcast_reading_list(&event_bus).await;
        }
        ReaderMessage::Heartbeat => {
            // 更新心跳时间
            let readers = event_bus.get_all_readers().await;
            if let Some(mut info) = readers.iter().find(|r| r.fingerprint == fingerprint).cloned() {
                info.last_heartbeat = Utc::now().timestamp();
                event_bus.update_reader_info(client_id, info).await;
            }
        }
    }
    
    Ok(())
}

/// 广播当前阅读列表给所有读者
async fn broadcast_reading_list(event_bus: &EventBus) {
    let reading_list = event_bus.get_reading_list().await;
    let items: Vec<ReadingItem> = reading_list
        .into_iter()
        .map(|(page_type, page_id, page_title, reader_count)| ReadingItem {
            page_type,
            page_id,
            page_title,
            reader_count,
        })
        .collect();
    
    let msg = ServerToReaderMessage::ReadingList { items };
    event_bus.broadcast_to_readers(msg).await;
}

/// 博主桌面客户端 WebSocket 端点（使用环境变量认证）
/// 用于接收博主通过桌面工具上传的窗口和媒体信息
#[get("/owner-desktop?<token>")]
pub fn owner_desktop_ws(
    ws: WebSocket,
    token: Option<String>,
    event_bus: &State<EventBus>,
) -> Channel<'static> {
    let event_bus = event_bus.inner().clone();
    let token = token.clone();
    
    ws.channel(move |stream| {
        Box::pin(handle_owner_desktop_connection(stream, event_bus, token))
    })
}

/// 处理博主桌面客户端 WebSocket 连接
async fn handle_owner_desktop_connection(
    mut stream: rocket_ws::stream::DuplexStream,
    event_bus: EventBus,
    token: Option<String>,
) -> Result<(), rocket_ws::result::Error> {
    // 验证 token
    let expected_token = match std::env::var("OWNER_DESKTOP_TOKEN") {
        Ok(t) => {
            log::info!("环境变量 OWNER_DESKTOP_TOKEN 已设置");
            t
        }
        Err(e) => {
            log::error!("环境变量 OWNER_DESKTOP_TOKEN 未设置: {}", e);
            let error_msg = ServerToOwnerDesktopMessage::Error {
                message: "服务器配置错误：未设置 OWNER_DESKTOP_TOKEN".to_string(),
            };
            if let Ok(json) = error_msg.to_json() {
                let _ = stream.send(Message::Text(json)).await;
            }
            let _ = stream.close(Some(CloseFrame {
                code: CloseCode::Policy,
                reason: "服务器配置错误".into(),
            })).await;
            return Ok(());
        }
    };
    
    log::info!("收到 token: {:?}", token);
    log::info!("期望 token: {}", expected_token);
    
    if token.as_ref() != Some(&expected_token) {
        log::warn!("博主桌面客户端 WebSocket 认证失败: token 不匹配");
        let error_msg = ServerToOwnerDesktopMessage::Error {
            message: "认证失败：token 无效".to_string(),
        };
        if let Ok(json) = error_msg.to_json() {
            let _ = stream.send(Message::Text(json)).await;
        }
        // 使用 Policy 关闭码表示认证失败（类似 403）
        let _ = stream.close(Some(CloseFrame {
            code: CloseCode::Policy,
            reason: "认证失败".into(),
        })).await;
        return Ok(());
    }
    
    log::info!("博主桌面客户端 WebSocket 认证成功，已连接");
    
    // 发送连接成功消息
    let connected_msg = ServerToOwnerDesktopMessage::Connected;
    if let Ok(json) = connected_msg.to_json() {
        let _ = stream.send(Message::Text(json)).await;
    }
    
    // 用于存储待处理的封面上传元数据
    let mut pending_artwork: Option<(String, String)> = None; // (content_item_identifier, mime_type)
    
    // 处理消息循环
    loop {
        match stream.next().await {
            Some(Ok(Message::Text(text))) => {
                match handle_owner_desktop_message(&text, &event_bus, &mut pending_artwork).await {
                    Ok(Some(response)) => {
                        if let Ok(json) = response.to_json() {
                            let _ = stream.send(Message::Text(json)).await;
                        }
                    }
                    Ok(None) => {}
                    Err(e) => {
                        log::error!("处理博主桌面客户端消息失败: {}", e);
                        let error_msg = ServerToOwnerDesktopMessage::Error { message: e };
                        if let Ok(json) = error_msg.to_json() {
                            let _ = stream.send(Message::Text(json)).await;
                        }
                    }
                }
            }
            Some(Ok(Message::Binary(data))) => {
                // 处理二进制消息（封面图片）
                if let Some((content_item_identifier, mime_type)) = pending_artwork.take() {
                    match handle_artwork_upload(&content_item_identifier, data, &mime_type).await {
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
                            log::error!("处理封面上传失败: {}", e);
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
                log::error!("WebSocket 错误: {}", e);
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
async fn handle_owner_desktop_message(
    text: &str,
    event_bus: &EventBus,
    pending_artwork: &mut Option<(String, String)>,
) -> Result<Option<ServerToOwnerDesktopMessage>, String> {
    let desktop_msg: OwnerDesktopMessage = serde_json::from_str(text)
        .map_err(|e| format!("解析消息失败: {}", e))?;
    
    match desktop_msg {
        OwnerDesktopMessage::WindowInfo { data } => {
            log::info!(
                "收到博主窗口信息: title={}, process={}",
                data.title,
                data.process_name
            );
            
            // 广播窗口信息到所有读者
            let msg = ServerToReaderMessage::OwnerWindowInfo {
                window_info: data,
                updated_at: Utc::now().timestamp(),
            };
            event_bus.broadcast_to_readers(msg).await;
            
            Ok(None)
        }
        OwnerDesktopMessage::MediaPlayback { metadata, playback_state } => {
            log::info!(
                "收到博主媒体播放状态: title={:?}, artist={:?}, playing={}",
                metadata.title,
                metadata.artist,
                playback_state.playing
            );
            
            // 广播媒体播放状态到所有读者
            let msg = ServerToReaderMessage::OwnerMediaPlayback {
                metadata,
                playback_state,
                updated_at: Utc::now().timestamp(),
            };
            event_bus.broadcast_to_readers(msg).await;
            
            Ok(None)
        }
        OwnerDesktopMessage::UploadArtwork { content_item_identifier, artwork_data, mime_type } => {
            // 处理 JSON 中包含的封面数据（不推荐，但支持）
            log::info!(
                "收到博主媒体封面上传（JSON）: content_id={}, size={} bytes, mime={}",
                content_item_identifier,
                artwork_data.len(),
                mime_type
            );
            
            match handle_artwork_upload(&content_item_identifier, artwork_data, &mime_type).await {
                Ok(artwork_url) => {
                    Ok(Some(ServerToOwnerDesktopMessage::ArtworkUploaded {
                        content_item_identifier,
                        artwork_url,
                    }))
                }
                Err(e) => Err(e),
            }
        }
        OwnerDesktopMessage::UploadArtworkMeta { content_item_identifier, mime_type } => {
            // 存储元数据，等待下一个二进制消息
            log::info!(
                "收到封面上传元数据: content_id={}, mime={}",
                content_item_identifier,
                mime_type
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
    
    // 使用 content_item_identifier 的 hash 作为文件名（避免特殊字符）
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    content_item_identifier.hash(&mut hasher);
    let filename = format!("{:x}.{}", hasher.finish(), ext);
    
    // 确保目录存在
    let artwork_dir = std::path::Path::new("./cache/artworks");
    if !artwork_dir.exists() {
        std::fs::create_dir_all(artwork_dir)
            .map_err(|e| format!("创建封面目录失败: {}", e))?;
    }
    
    let filepath = artwork_dir.join(&filename);
    
    // 保存文件
    std::fs::write(&filepath, &artwork_data)
        .map_err(|e| format!("保存封面文件失败: {}", e))?;
    
    log::info!("封面已保存: {}", filepath.display());
    
    // 生成 URL
    let artwork_url = format!("/api/static/artworks/{}", filename);
    
    Ok(artwork_url)
}
