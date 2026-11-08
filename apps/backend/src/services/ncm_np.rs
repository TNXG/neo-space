mod api;
use bson::doc;
use mongodb::Database;
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;
pub type NeteaseError = Box<dyn std::error::Error + Send + Sync>;

// ==================== Service Layer ====================

/// Cached `NetEase` now playing status
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CachedNowPlaying {
    pub(crate) active: bool,
    pub(crate) song_id: Option<String>,
    pub(crate) song_name: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) cover: Option<String>,
    pub(crate) duration: Option<Duration>,
    pub(crate) last_song_change: Instant, // 记录歌曲 ID 最后变更时间
}

/// Song expiration timeout (5 minutes)
const FALLBACK_SONG_EXPIRY_DURATION: Duration = Duration::from_mins(5);
/// 额外宽限时间，用于容忍接口轮询和播放结束之间的短暂延迟。
const SONG_EXPIRY_GRACE_DURATION: Duration = Duration::from_secs(15);

/// `NetEase` Cloud Music Now Playing Service
#[derive(Clone)]
pub struct NeteaseNowPlayingService {
    db: Database,
    http_client: reqwest::Client,
    cache: Arc<RwLock<Option<CachedNowPlaying>>>,
    pub owner_netease_id: Arc<RwLock<Option<String>>>,
}

impl NeteaseNowPlayingService {
    /// Create a new `NetEase` now playing service
    pub fn new(db: Database, http_client: reqwest::Client) -> Self {
        Self {
            db,
            http_client,
            cache: Arc::new(RwLock::new(None)),
            owner_netease_id: Arc::new(RwLock::new(None)),
        }
    }

    /// Load owner's `NetEase` user ID from database
    pub async fn load_owner_netease_id(&self) -> Result<(), NeteaseError> {
        let collection = self.db.collection::<bson::Document>("owner_profiles");

        let doc = collection
            .find_one(doc! {})
            .await
            .map_err(|e| format!("Failed to query owner_profiles: {e}"))?
            .ok_or("Owner profile not found")?;

        let netease_id = doc
            .get_document("socialIds")
            .ok()
            .and_then(|d| d.get_str("netease").ok())
            .map(std::string::ToString::to_string);

        let mut guard = self.owner_netease_id.write().await;
        *guard = netease_id;

        if let Some(ref id) = *guard {
            tracing::info!("Loaded owner NetEase ID: {}", id);
        } else {
            tracing::warn!("Owner NetEase ID not found in socialIds");
        }
        drop(guard);

        Ok(())
    }

    /// Get owner's `NetEase` user ID
    async fn get_owner_netease_id(&self) -> Result<String, NeteaseError> {
        let guard = self.owner_netease_id.read().await;
        guard
            .as_ref()
            .map(std::clone::Clone::clone)
            .ok_or_else(|| "Owner NetEase ID not loaded".into())
    }

    /// Fetch current playing status from `NetEase` API
    pub async fn fetch_now_playing(&self) -> Result<Option<CachedNowPlaying>, NeteaseError> {
        let user_id = self.get_owner_netease_id().await?;
        let user_id: u64 = user_id.parse()?;

        let json = api::get_ncm_now_play(user_id, &self.http_client).await?;

        // 实际响应结构: data.song (对象) 存在时表示正在播放
        let song = json
            .get("data")
            .and_then(|d| d.get("song"))
            .and_then(|s| s.as_object());

        let song_data = song.map_or_else(
            || CachedNowPlaying {
                active: false,
                song_id: None,
                song_name: None,
                artist: None,
                album: None,
                cover: None,
                duration: None,
                last_song_change: Instant::now(), // 停止播放，记录当前时间
            },
            |song| {
                let id = song
                    .get("id")
                    .and_then(serde_json::Value::as_i64)
                    .map(|v| v.to_string());
                let name = song
                    .get("name")
                    .and_then(|v| v.as_str())
                    .map(std::string::ToString::to_string);
                let artist = song
                    .get("artists")
                    .and_then(|v| v.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|v| v.as_object())
                    .and_then(|obj| obj.get("name"))
                    .and_then(|v| v.as_str())
                    .map(std::string::ToString::to_string);
                let album_obj = song.get("album").and_then(|v| v.as_object());
                let album = album_obj
                    .and_then(|obj| obj.get("name"))
                    .and_then(|v| v.as_str())
                    .map(std::string::ToString::to_string);
                let cover = album_obj
                    .and_then(|obj| obj.get("picUrl"))
                    .and_then(|v| v.as_str())
                    .map(std::string::ToString::to_string);
                let duration = song
                    .get("duration")
                    .or_else(|| song.get("dt"))
                    .and_then(serde_json::Value::as_u64)
                    .map(Duration::from_millis);

                CachedNowPlaying {
                    active: true,
                    song_id: id,
                    song_name: name,
                    artist,
                    album,
                    cover,
                    duration,
                    last_song_change: Instant::now(), // 新歌曲，记录当前时间
                }
            },
        );

        Ok(Some(song_data))
    }

    /// Update cache with new playing status (refreshes TTL)
    pub async fn update_cache(&self, status: CachedNowPlaying) {
        let mut guard = self.cache.write().await;

        // 如果歌曲 ID 发生变化，更新 last_song_change 时间
        let new_status = if let Some(ref existing) = *guard {
            if existing.song_id == status.song_id {
                // 歌曲未变更，保留原有的 last_song_change
                CachedNowPlaying {
                    last_song_change: existing.last_song_change,
                    ..status
                }
            } else {
                // 歌曲变更，重置时间
                CachedNowPlaying {
                    last_song_change: Instant::now(),
                    ..status
                }
            }
        } else {
            // 首次缓存
            CachedNowPlaying {
                last_song_change: Instant::now(),
                ..status
            }
        };

        *guard = Some(new_status);
    }

    pub async fn get_cached(&self) -> Option<CachedNowPlaying> {
        let guard = self.cache.read().await;
        guard.clone()
    }

    /// Check if the current song is expired (for broadcasting inactive status)
    pub async fn is_song_expired(&self) -> bool {
        let guard = self.cache.read().await;
        guard.as_ref().is_some_and(|cached| {
            cached.active && cached.last_song_change.elapsed() > song_expiry_duration(cached)
        })
    }

    /// Get playing status as `NeteaseNowPlaying` for WebSocket broadcast
    pub async fn get_now_playing(&self) -> Option<crate::models::realtime::NeteaseNowPlaying> {
        let cached = {
            let guard = self.cache.read().await;
            guard.clone()
        };

        let Some(cached) = cached else {
            return Some(crate::models::realtime::NeteaseNowPlaying {
                active: false,
                song: None,
            });
        };

        // 检查歌曲是否过期，优先使用歌曲时长，缺失时回退到固定时长。
        let expiry_duration = song_expiry_duration(&cached);
        let is_expired = cached.active && cached.last_song_change.elapsed() > expiry_duration;

        if is_expired {
            tracing::debug!(
                "Song expired: {:?} has been playing for {:?} (> {:?})",
                cached.song_name,
                cached.last_song_change.elapsed(),
                expiry_duration
            );
        }

        if !cached.active || is_expired {
            return Some(crate::models::realtime::NeteaseNowPlaying {
                active: false,
                song: None,
            });
        }

        Some(crate::models::realtime::NeteaseNowPlaying {
            active: true,
            song: Some(crate::models::realtime::NeteaseSong {
                id: cached.song_id.unwrap_or_default(),
                name: cached.song_name.unwrap_or_default(),
                artist: cached.artist.unwrap_or_default(),
                album: cached.album.unwrap_or_default(),
                cover: cached.cover.unwrap_or_default(),
            }),
        })
    }
}

/// 计算歌曲过期时长，优先使用接口返回的歌曲时长，缺失时使用保守兜底值。
fn song_expiry_duration(cached: &CachedNowPlaying) -> Duration {
    cached
        .duration
        .map_or(FALLBACK_SONG_EXPIRY_DURATION, |duration| {
            duration + SONG_EXPIRY_GRACE_DURATION
        })
}
