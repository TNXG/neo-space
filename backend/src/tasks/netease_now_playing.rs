//! NetEase Cloud Music Now Playing background task
//!
//! Periodically polls the NetEase API for the owner's current playing status
//! and broadcasts updates to WebSocket readers.

use crate::app::SharedState;
use crate::models::realtime::ServerToReaderMessage;
use crate::realtime::common::broadcast_to_all_readers;
use crate::services::ncm_np::{NeteaseError, NeteaseNowPlayingService};
use std::time::Duration;
use tokio::time::interval;

/// Polling interval for NetEase now playing (30 seconds)
const POLL_INTERVAL_SECS: u64 = 5;

/// Start the NetEase now playing polling task
pub fn start_netease_now_playing_task(_state: SharedState, service: NeteaseNowPlayingService) {
    tokio::spawn(async move {
        // Initial load of owner NetEase ID
        let should_run = match service.load_owner_netease_id().await {
            Ok(()) => {
                let guard = service.owner_netease_id.read().await;
                let has_id = guard.is_some();
                drop(guard);
                if !has_id {
                    tracing::warn!("[NetEase] 博主 NetEase ID 未配置，跳过轮询");
                }
                has_id
            }
            Err(e) => {
                tracing::warn!("[NetEase] 无法加载博主 NetEase ID: {}，跳过轮询", e);
                false
            }
        };

        if !should_run {
            return;
        }

        let mut timer = interval(Duration::from_secs(POLL_INTERVAL_SECS));
        timer.tick().await; // Skip first immediate tick

        tracing::info!("[NetEase] 轮询已启动，间隔: {} 秒", POLL_INTERVAL_SECS);

        loop {
            timer.tick().await;

            if let Err(e) = fetch_and_broadcast(&service).await {
                tracing::warn!("[NetEase] 轮询失败: {}", e);
            }
        }
    });
}

/// Fetch now playing status and broadcast if changed
async fn fetch_and_broadcast(service: &NeteaseNowPlayingService) -> Result<bool, NeteaseError> {
    // Fetch current status from API
    let new_status = service
        .fetch_now_playing()
        .await?
        .ok_or("No data returned")?;

    // Get previous cached status for comparison
    let prev_status = service.get_cached().await;

    // Check if the song is expired before fetching
    let was_expired_before = service.is_song_expired().await;

    // Check if status changed: only active state or song ID matters
    let has_changed = match &prev_status {
        None => true,
        Some(prev) => prev.song_id != new_status.song_id,
    };

    // Always update cache to refresh TTL, even when unchanged
    service.update_cache(new_status.clone()).await;

    // Check if expired status has changed after update
    let is_expired_after = service.is_song_expired().await;

    // Need to broadcast if status changed OR if expiry status changed
    let should_broadcast = has_changed || (was_expired_before != is_expired_after);

    if should_broadcast {
        // Log status change
        if was_expired_before && !is_expired_after && new_status.active {
            // Was expired but now playing again
            if let (Some(song_name), Some(artist)) = (&new_status.song_name, &new_status.artist) {
                tracing::info!("[NetEase] 恢复播放: {} - {}", song_name, artist);
            }
        } else if !was_expired_before && is_expired_after {
            // Just expired
            if let Some(prev) = &prev_status
                && let (Some(song_name), Some(artist)) = (&prev.song_name, &prev.artist)
            {
                tracing::info!(
                    "[NetEase] 歌曲过期: {} - {} (超过 5 分钟)",
                    song_name,
                    artist
                );
            }
        } else if new_status.active {
            // Switched to playing / changed song
            if let (Some(song_name), Some(artist)) = (&new_status.song_name, &new_status.artist) {
                let prev_song_name = prev_status.as_ref().and_then(|p| p.song_name.as_ref());

                if prev_song_name.is_some_and(|n| n != song_name) {
                    tracing::info!("[NetEase] 切换歌曲: {} - {}", song_name, artist);
                } else if prev_status.is_none()
                    || !prev_status.as_ref().map(|p| p.active).unwrap_or(false)
                {
                    tracing::info!("[NetEase] 开始播放: {} - {}", song_name, artist);
                } else {
                    tracing::info!("[NetEase] 播放状态更新: {} - {}", song_name, artist);
                }
            }
        } else {
            let was_active = prev_status.as_ref().map(|p| p.active).unwrap_or(false);
            if was_active {
                tracing::info!("[NetEase] 停止播放");
            } else if prev_status.is_none() {
                tracing::info!("[NetEase] 首次轮询完成，当前未在播放");
            }
        }

        // Broadcast to all readers
        if let Some(netease_status) = service.get_now_playing().await {
            let now = chrono::Utc::now().timestamp();
            let message = ServerToReaderMessage::OwnerMediaPlayback {
                // Empty metadata/playback_state - NetEase status only
                metadata: crate::models::realtime::MediaMetadata {
                    bundle_identifier: None,
                    title: None,
                    artist: None,
                    album: None,
                    duration: 0.0,
                    artwork_url: None,
                    content_item_identifier: None,
                },
                playback_state: crate::models::realtime::PlaybackState {
                    playing: false,
                    playback_rate: 1.0,
                    elapsed_time: 0.0,
                },
                netease: Some(netease_status),
                updated_at: now,
            };

            broadcast_to_all_readers(message).await;
        }
    }

    Ok(should_broadcast)
}
