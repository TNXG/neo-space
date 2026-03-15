use aes::cipher::block_padding::Pkcs7;
use aes::cipher::{BlockDecryptMut, BlockEncryptMut, KeyInit};
use aes::Aes128;
use bson::doc;
use ecb::{Decryptor, Encryptor};
use md5;
use moka::future::Cache;
use mongodb::Database;
use rand::RngExt;
use reqwest::header::{HeaderMap, ACCEPT, ACCEPT_ENCODING, CONTENT_TYPE, COOKIE, USER_AGENT};
use serde::Serialize;
use serde_json::Value;
pub type NeteaseError = Box<dyn std::error::Error + Send + Sync>;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;

const EAPI_KEY: &str = "e82ckenh8dichen8";
const USER_STATUS_DETAIL_API: &str = "/api/social/user/status/detail";
const DEVICE_ID: &str = "b464d3d44ed8210cee17e297dcaf730a";

static USER_AGENT_LIST: &[&str] = &[
    "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1",
    "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36",
    "Mozilla/5.0 (Linux; Android 5.1.1; Nexus 6 Build/LYZ28E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.115 Mobile Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_2 like Mac OS X) AppleWebKit/603.2.4 (KHTML, like Gecko) Mobile/14F89;GameHelper",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 10_0 like Mac OS X) AppleWebKit/602.1.38 (KHTML, like Gecko) Version/10.0 Mobile/14A300 Safari/602.1",
    "NeteaseMusic/6.5.0.1575377963(164);Dalvik/2.1.0 (Linux; U; Android 9; MIX 2 MIUI/V12.0.1.0.PDECNXM)",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UserStatusDetailReqJson {
    visitor_id: String,
    device_id: String,
    e_r: bool,
}

pub async fn get_ncm_now_play(user_id: u64) -> Result<Value, NeteaseError> {
    let req_json = create_user_status_detail_req_json(user_id);
    let encrypted_params = eapi_encrypt(USER_STATUS_DETAIL_API, &req_json);

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, "application/x-www-form-urlencoded".parse()?);
    headers.insert(USER_AGENT, choose_user_agent().parse()?);
    headers.insert(ACCEPT, "*/*".parse()?);
    // 避免服务端返回压缩体导致解密失败
    headers.insert(ACCEPT_ENCODING, "identity".parse()?);

    let buildver = SystemTime::now()
        .duration_since(UNIX_EPOCH)?
        .as_secs()
        .to_string();
    let music_u = "007150BAAAA7BA9258710E7466D2E1E41FF071C7836023FBE902B3BE4DB4BD0579B407DB5806514C2F26405BA778BB18E6DBCDF304B1CA594C4492A79E5FCD5DC6E435696A8FA4B833EDA0A13B6606FF8C6F048095623F4E93A680FED39FA2289B9D1ADDA2889C5ACFDA71B1F97721D2262E57DC14F1BDD24899D91682E70DDB4E733642349656FF0C1446B550DE4AC8C83125B6C73B5BED4426754477B6826EEE1B9E9D637813341F8B2BD470DDEF7BD1F9E7D5A9C361F032055A0A1D9C3AE9AFBE284A6B869A36676910075EB9EF3C1864C38009AD5840CFCAECEF84EBC20B5BE1CFB7689687CE6984428D465CD99B3129252D505B27FA3140BAE8BC0EA6569487BFBE3C9C3A3ED024ED7B5270B6421A2D4F8AEC937AB031BA91B43A641F6F4F";

    let cookie_string = format!("appver=9.3.35; buildver={}; MUSIC_U={}", buildver, music_u);
    headers.insert(COOKIE, cookie_string.parse()?);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;
    let response = client
        .post("https://interface3.music.163.com/eapi/social/user/status/detail")
        .headers(headers)
        .body(encrypted_params)
        .send()
        .await?;
    // Body bytes
    let body_bytes = response.bytes().await?;

    // 1) 优先尝试直接按 JSON 解析（部分情况下接口会直接返回明文 JSON 错误信息）
    if let Ok(text) = std::str::from_utf8(&body_bytes)
        && (text.trim_start().starts_with('{') || text.trim_start().starts_with('['))
        && let Ok(json) = serde_json::from_str::<Value>(text)
    {
        return Ok(json);
    }

    // 2) 尝试 AES-128-ECB-PKCS7 解密
    let mut buf = body_bytes.to_vec();
    let key = generate_key(EAPI_KEY.as_bytes());
    let cipher = Decryptor::<Aes128>::new(&key.into());
    let decrypted_slice = cipher
        .decrypt_padded_mut::<Pkcs7>(&mut buf)
        .map_err(|e| format!("Decryption failed: {}", e))?;
    let decrypted_str = String::from_utf8(decrypted_slice.to_vec())?;
    let json: Value = serde_json::from_str(&decrypted_str)?;
    Ok(json)
}

fn generate_key(key: &[u8]) -> [u8; 16] {
    let mut gen_key = [0u8; 16];
    let len_to_copy = std::cmp::min(key.len(), 16);

    // Use get_mut for safe slicing
    if let Some(dest) = gen_key.get_mut(..len_to_copy)
        && let Some(src) = key.get(..len_to_copy)
    {
        dest.copy_from_slice(src);
    }

    // XOR remaining bytes into key
    for (i, byte) in key.iter().skip(16).enumerate() {
        let idx = i % 16;
        if let Some(g) = gen_key.get_mut(idx) {
            *g ^= byte;
        }
    }
    gen_key
}

fn eapi_encrypt(path: &str, data: &str) -> String {
    let nobody_know_this = "36cd479b6b5";
    let text_for_md5 = format!("nobody{}use{}md5forencrypt", path, data);
    let md5_hash = format!("{:x}", md5::compute(text_for_md5.as_bytes()));

    let text_to_encrypt = format!(
        "{}-{}-{}-{}-{}",
        path, nobody_know_this, data, nobody_know_this, md5_hash
    );
    let plaintext = text_to_encrypt.as_bytes();

    let key = generate_key(EAPI_KEY.as_bytes());
    let cipher = Encryptor::<Aes128>::new(&key.into());

    let mut buf = vec![0u8; plaintext.len() + 16];
    if let Some(dest) = buf.get_mut(..plaintext.len()) {
        dest.copy_from_slice(plaintext);
    }
    let ciphertext = cipher
        .encrypt_padded_mut::<Pkcs7>(&mut buf, plaintext.len())
        .expect("Encryption failed: buffer too small"); // This is safe

    format!("params={}", hex::encode(ciphertext).to_uppercase())
}

fn create_user_status_detail_req_json(visitor_id: u64) -> String {
    let req_body = UserStatusDetailReqJson {
        visitor_id: visitor_id.to_string(),
        device_id: DEVICE_ID.to_string(),
        e_r: true,
    };
    serde_json::to_string(&req_body).unwrap_or_default()
}

fn choose_user_agent() -> &'static str {
    let mut rng = rand::rng();
    let index = rng.random_range(0..USER_AGENT_LIST.len());
    // Use get for safe indexing
    USER_AGENT_LIST.get(index).copied().unwrap_or_else(|| USER_AGENT_LIST.first().copied().unwrap_or("Mozilla/5.0"))
}

// ==================== Service Layer ====================

/// Cached NetEase now playing status
#[derive(Debug, Clone, PartialEq)]
pub(crate) struct CachedNowPlaying {
    pub(crate) active: bool,
    pub(crate) song_id: Option<String>,
    pub(crate) song_name: Option<String>,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) cover: Option<String>,
}

/// NetEase Cloud Music Now Playing Service
#[derive(Clone)]
pub struct NeteaseNowPlayingService {
    db: Database,
    cache: Arc<Cache<String, CachedNowPlaying>>,
    pub owner_netease_id: Arc<RwLock<Option<String>>>,
}

impl NeteaseNowPlayingService {
    /// Create a new NetEase now playing service
    pub fn new(db: Database) -> Self {
        // Cache with 5-minute TTL, key = "owner" (single owner)
        let cache = Cache::builder()
            .max_capacity(100)
            .time_to_live(Duration::from_secs(300))
            .build();

        Self {
            db,
            cache: Arc::new(cache),
            owner_netease_id: Arc::new(RwLock::new(None)),
        }
    }

    /// Load owner's NetEase user ID from database
    pub async fn load_owner_netease_id(&self) -> Result<(), NeteaseError> {
        let collection = self.db.collection::<bson::Document>("owner_profiles");

        let doc = collection
            .find_one(doc! {})
            .await
            .map_err(|e| format!("Failed to query owner_profiles: {}", e))?
            .ok_or("Owner profile not found")?;

        let netease_id = doc
            .get_document("socialIds")
            .ok()
            .and_then(|d| d.get_str("netease").ok())
            .map(|s| s.to_string());

        let mut guard = self.owner_netease_id.write().await;
        *guard = netease_id;

        if let Some(ref id) = *guard {
            tracing::info!("Loaded owner NetEase ID: {}", id);
        } else {
            tracing::warn!("Owner NetEase ID not found in socialIds");
        }

        Ok(())
    }

    /// Get owner's NetEase user ID
    async fn get_owner_netease_id(&self) -> Result<String, NeteaseError> {
        let guard = self.owner_netease_id.read().await;
        guard
            .as_ref()
            .map(|s| s.clone())
            .ok_or_else(|| "Owner NetEase ID not loaded".into())
    }

    /// Fetch current playing status from NetEase API
    pub async fn fetch_now_playing(&self) -> Result<Option<CachedNowPlaying>, NeteaseError> {
        let user_id = self.get_owner_netease_id().await?;
        let user_id: u64 = user_id.parse()?;

        let json = get_ncm_now_play(user_id).await?;

        // 实际响应结构: data.song (对象) 存在时表示正在播放
        let song = json
            .get("data")
            .and_then(|d| d.get("song"))
            .and_then(|s| s.as_object());

        let song_data = if let Some(song) = song {
            let id = song.get("id").and_then(|v| v.as_i64()).map(|v| v.to_string());
            let name = song.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
            let artist = song
                .get("artists")
                .and_then(|v| v.as_array())
                .and_then(|arr| arr.first())
                .and_then(|v| v.as_object())
                .and_then(|obj| obj.get("name"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let album_obj = song.get("album").and_then(|v| v.as_object());
            let album = album_obj.and_then(|obj| obj.get("name")).and_then(|v| v.as_str()).map(|s| s.to_string());
            let cover = album_obj.and_then(|obj| obj.get("picUrl")).and_then(|v| v.as_str()).map(|s| s.to_string());

            CachedNowPlaying {
                active: true,
                song_id: id,
                song_name: name,
                artist,
                album,
                cover,
            }
        } else {
            CachedNowPlaying {
                active: false,
                song_id: None,
                song_name: None,
                artist: None,
                album: None,
                cover: None,
            }
        };

        Ok(Some(song_data))
    }

    /// Update cache with new playing status (refreshes TTL)
    pub async fn update_cache(&self, status: CachedNowPlaying) {
        self.cache.insert("owner".to_string(), status).await;
    }

    /// Get cached playing status
    pub async fn get_cached(&self) -> Option<CachedNowPlaying> {
        self.cache.get("owner").await
    }

    /// Get playing status as NeteaseNowPlaying for WebSocket broadcast
    pub async fn get_now_playing(&self) -> Option<crate::models::realtime::NeteaseNowPlaying> {
        let cached = self.get_cached().await?;

        if !cached.active {
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
