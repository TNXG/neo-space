//! Bangumi 收藏分页代理与人物图片裁切缓存。

use crate::{
    app::SharedState,
    error::{AppError, AppQuery, AppResult},
    models::{ApiResponse, BangumiImageCrop, PaginatedData, Pagination, UpsertBangumiImageCrop},
    services::bangumi_crop::{
        DetectedImageCrop, detect_anime_upper_body, detect_person_upper_body, image_url_hash,
    },
};
use axum::{extract::State, response::Json};
use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::{IndexModel, options::IndexOptions};
use serde::Deserialize;
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, OnceLock},
};
use tokio::sync::{Mutex, Semaphore, mpsc};

const ALLOWED_SOURCE_TYPES: [&str; 2] = ["character", "person"];
const BANGUMI_API_BASE_URL: &str = "https://api.bgm.tv/v0";
const DEFAULT_PAGE_SIZE: u64 = 18;
const MAX_PAGE_SIZE: u64 = 50;
const CROP_QUEUE_CAPACITY: usize = 128;
const CROP_WORKER_CONCURRENCY: usize = 2;
const CROP_FALLBACK_VERSION: &str = "layout-fallback@3";
const CROP_GEOMETRY_VERSION: &str = "portrait-4x5-v5";

static CROP_QUEUE: OnceLock<mpsc::Sender<CropCandidate>> = OnceLock::new();
static QUEUED_CROPS: OnceLock<Arc<Mutex<HashSet<String>>>> = OnceLock::new();

#[derive(Debug, Deserialize)]
struct BangumiPage {
    total: usize,
    data: Vec<Value>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum BangumiLibrarySection {
    Anime,
    Game,
    Book,
    Characters,
    Persons,
}

#[derive(Debug, Deserialize)]
pub struct BangumiLibraryParams {
    section: Option<BangumiLibrarySection>,
    page: Option<u64>,
    size: Option<u64>,
    status: Option<u8>,
}

#[derive(Debug, Clone)]
struct CropCandidate {
    source_type: &'static str,
    source_id: i64,
    image_url: String,
}

/// GET /bangumi/profile — 返回后台配置用户的公开资料。
pub async fn get_profile(State(state): State<SharedState>) -> AppResult<Json<ApiResponse<Value>>> {
    let username = configured_username(&state)?;
    let encoded_username = urlencoding::encode(&username);
    let profile = fetch_bangumi_value(&state, &format!("/users/{encoded_username}")).await?;
    Ok(Json(ApiResponse::success(profile)))
}

/// GET /bangumi/library — 将本站页码同步映射为 Bangumi 的 limit/offset。
pub async fn get_library(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<BangumiLibraryParams>,
) -> AppResult<Json<ApiResponse<PaginatedData<Value>>>> {
    let username = configured_username(&state)?;
    let section = params.section.unwrap_or(BangumiLibrarySection::Anime);
    let page = params.page.unwrap_or(1).max(1);
    let size = params
        .size
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .clamp(1, MAX_PAGE_SIZE);
    let path = library_path(&username, section, params.status)?;
    let mut upstream_page = fetch_bangumi_page(&state, &path, page, size).await?;

    if let Some(source_type) = section.source_type() {
        let candidates = collect_crop_candidates(&upstream_page.data, source_type);
        let crop_map = load_crop_map(&state, &candidates).await?;
        attach_crops(&mut upstream_page.data, source_type, &crop_map)?;
        enqueue_missing_crops(&state, candidates, &crop_map).await;
    }

    let total = i64::try_from(upstream_page.total)
        .map_err(|_| AppError::Internal("Bangumi total exceeds supported range".to_string()))?;
    let current_page = i64::try_from(page)
        .map_err(|_| AppError::BadRequest("Invalid Bangumi page".to_string()))?;
    let page_size = i64::try_from(size)
        .map_err(|_| AppError::BadRequest("Invalid Bangumi page size".to_string()))?;

    Ok(Json(ApiResponse::success(PaginatedData {
        items: upstream_page.data,
        pagination: Pagination::new(total, current_page, page_size),
    })))
}

impl BangumiLibrarySection {
    /// 返回人物类型对应的裁切缓存来源；作品收藏不参与人物检测。
    fn source_type(self) -> Option<&'static str> {
        match self {
            Self::Characters => Some("character"),
            Self::Persons => Some("person"),
            Self::Anime | Self::Game | Self::Book => None,
        }
    }
}

/// 读取后台配置的 Bangumi 用户名，禁止前端直接指定上游账号。
fn configured_username(state: &SharedState) -> AppResult<String> {
    let username = state.config().bangumi_username.trim().to_string();
    (!username.is_empty())
        .then_some(username)
        .ok_or_else(|| AppError::NotFound("Bangumi username is not configured".to_string()))
}

/// 根据收藏分区构造官方 API 路径，并仅对作品收藏透传状态筛选。
fn library_path(
    username: &str,
    section: BangumiLibrarySection,
    status: Option<u8>,
) -> AppResult<String> {
    if status.is_some_and(|value| !(1..=5).contains(&value)) {
        return Err(AppError::BadRequest(
            "Bangumi collection status must be between 1 and 5".to_string(),
        ));
    }

    let encoded_username = urlencoding::encode(username);
    let path = match section {
        BangumiLibrarySection::Anime => media_library_path(&encoded_username, 2, status),
        BangumiLibrarySection::Game => media_library_path(&encoded_username, 4, status),
        BangumiLibrarySection::Book => media_library_path(&encoded_username, 1, status),
        BangumiLibrarySection::Characters => {
            format!("/users/{encoded_username}/collections/-/characters")
        }
        BangumiLibrarySection::Persons => {
            format!("/users/{encoded_username}/collections/-/persons")
        }
    };
    Ok(path)
}

/// 构造作品收藏路径，状态值直接对应 Bangumi SubjectCollectionType。
fn media_library_path(username: &str, subject_type: u8, status: Option<u8>) -> String {
    let mut path = format!("/users/{username}/collections?subject_type={subject_type}");
    if let Some(status) = status {
        path.push_str(&format!("&type={status}"));
    }
    path
}

/// 请求一个 Bangumi 官方 JSON 资源。
async fn fetch_bangumi_value(state: &SharedState, path: &str) -> AppResult<Value> {
    state
        .http_client
        .get(format!("{BANGUMI_API_BASE_URL}{path}"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| AppError::Internal(format!("Bangumi request failed: {error}")))?
        .error_for_status()
        .map_err(|error| AppError::Internal(format!("Bangumi returned an error: {error}")))?
        .json::<Value>()
        .await
        .map_err(|error| AppError::Internal(format!("Invalid Bangumi response: {error}")))
}

/// 只请求当前页，避免一次页面访问遍历用户的全部收藏。
async fn fetch_bangumi_page(
    state: &SharedState,
    path: &str,
    page: u64,
    size: u64,
) -> AppResult<BangumiPage> {
    let separator = if path.contains('?') { '&' } else { '?' };
    let offset = (page - 1).saturating_mul(size);
    state
        .http_client
        .get(format!(
            "{BANGUMI_API_BASE_URL}{path}{separator}limit={size}&offset={offset}"
        ))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|error| AppError::Internal(format!("Bangumi request failed: {error}")))?
        .error_for_status()
        .map_err(|error| AppError::Internal(format!("Bangumi returned an error: {error}")))?
        .json::<BangumiPage>()
        .await
        .map_err(|error| AppError::Internal(format!("Invalid Bangumi page: {error}")))
}

/// 从当前人物页提取可检测的图片，队列不会扫描未请求的上游页面。
fn collect_crop_candidates(items: &[Value], source_type: &'static str) -> Vec<CropCandidate> {
    items
        .iter()
        .filter_map(|item| build_candidate(item, source_type))
        .collect()
}

/// 从官方条目中读取 ID 与优先级最高的图片 URL。
fn build_candidate(item: &Value, source_type: &'static str) -> Option<CropCandidate> {
    let source_id = item.pointer("/id")?.as_i64()?;
    let images = item.pointer("/images")?.as_object()?;
    let image_url = ["large", "common", "medium", "grid", "small"]
        .iter()
        .find_map(|key| images.get(*key).and_then(Value::as_str))?
        .to_string();
    Some(CropCandidate {
        source_type,
        source_id,
        image_url,
    })
}

/// 只读取当前页涉及的裁切缓存；读取路径不扫描整表，也不运行模型。
async fn load_crop_map(
    state: &SharedState,
    candidates: &[CropCandidate],
) -> AppResult<HashMap<String, BangumiImageCrop>> {
    let Some(first_candidate) = candidates.first() else {
        return Ok(HashMap::new());
    };
    let source_ids = candidates
        .iter()
        .map(|candidate| candidate.source_id)
        .collect::<Vec<_>>();
    let mut cursor = state
        .db
        .collection::<BangumiImageCrop>("bangumi_image_crops")
        .find(doc! {
            "sourceType": first_candidate.source_type,
            "sourceId": { "$in": source_ids },
        })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut crop_map = HashMap::new();
    while let Some(crop) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        crop_map.insert(crop_key(&crop.source_type, crop.source_id), crop);
    }
    Ok(crop_map)
}

/// 将已有裁切参数附加到当前页；缺失缓存不会阻塞响应。
fn attach_crops(
    items: &mut [Value],
    source_type: &str,
    crop_map: &HashMap<String, BangumiImageCrop>,
) -> AppResult<()> {
    for item in items {
        let source_id = item.get("id").and_then(Value::as_i64);
        let Some(crop) = source_id.and_then(|id| crop_map.get(&crop_key(source_type, id))) else {
            continue;
        };
        let object = item
            .as_object_mut()
            .ok_or_else(|| AppError::Internal("Invalid Bangumi collection item".to_string()))?;
        object.insert(
            "crop".to_string(),
            serde_json::to_value(crop).map_err(AppError::from)?,
        );
    }
    Ok(())
}

/// 将缺失或失效的裁切任务放入有界队列，队列满时直接跳过而不拖慢接口。
async fn enqueue_missing_crops(
    state: &SharedState,
    candidates: Vec<CropCandidate>,
    crop_map: &HashMap<String, BangumiImageCrop>,
) {
    let sender = crop_queue(state);
    let queued = queued_crops();

    for candidate in candidates {
        let key = crop_key(candidate.source_type, candidate.source_id);
        let requires_detection = crop_map.get(&key).is_none_or(|crop| {
            (crop.detector_version != CROP_FALLBACK_VERSION
                && (crop.crop_left.is_none() || automatic_crop_is_stale(crop)))
                || crop
                    .image_url_hash
                    .as_deref()
                    .is_some_and(|hash| hash != image_url_hash(&candidate.image_url))
        });
        if !requires_detection {
            continue;
        }

        let mut queued_keys = queued.lock().await;
        if !queued_keys.insert(key.clone()) {
            continue;
        }
        if sender.try_send(candidate).is_err() {
            queued_keys.remove(&key);
            tracing::warn!(source = %key, "Bangumi 裁切队列已满，本次请求跳过该任务");
        }
    }
}

/// 延迟初始化进程内有界队列，并用信号量限制模型推理并发。
fn crop_queue(state: &SharedState) -> mpsc::Sender<CropCandidate> {
    CROP_QUEUE
        .get_or_init(|| {
            let (sender, mut receiver) = mpsc::channel::<CropCandidate>(CROP_QUEUE_CAPACITY);
            let worker_state = state.clone();
            let semaphore = Arc::new(Semaphore::new(CROP_WORKER_CONCURRENCY));
            tokio::spawn(async move {
                while let Some(candidate) = receiver.recv().await {
                    let Ok(permit) = semaphore.clone().acquire_owned().await else {
                        break;
                    };
                    let worker_state = worker_state.clone();
                    tokio::spawn(async move {
                        let _permit = permit;
                        let key = crop_key(candidate.source_type, candidate.source_id);
                        if let Err(error) = resolve_candidate_crop(&worker_state, candidate).await {
                            tracing::warn!(source = %key, ?error, "Bangumi 裁切后台任务失败");
                        }
                        queued_crops().lock().await.remove(&key);
                    });
                }
            });
            sender
        })
        .clone()
}

/// 返回队列去重集合，避免多个页面请求重复提交同一张图片。
fn queued_crops() -> Arc<Mutex<HashSet<String>>> {
    QUEUED_CROPS
        .get_or_init(|| Arc::new(Mutex::new(HashSet::new())))
        .clone()
}

/// 仅升级模型自动生成的旧几何参数，避免覆盖人工校正数据。
fn automatic_crop_is_stale(crop: &BangumiImageCrop) -> bool {
    let is_automatic = crop.detector_version.starts_with("deepghs/")
        || crop.detector_version.starts_with("ultralytics/")
        || crop.detector_version.starts_with("layout-fallback@");
    is_automatic && !crop.detector_version.ends_with(CROP_GEOMETRY_VERSION)
}

/// 在后台运行来源匹配的检测器，并将稳定结果幂等写入数据库。
async fn resolve_candidate_crop(state: &SharedState, candidate: CropCandidate) -> AppResult<()> {
    let detection = match candidate.source_type {
        "person" => detect_person_upper_body(&state.http_client, &candidate.image_url).await,
        "character" => detect_anime_upper_body(&state.http_client, &candidate.image_url).await,
        _ => {
            return Err(AppError::Internal(
                "Invalid Bangumi portrait candidate".to_string(),
            ));
        }
    };
    let detected = match detection {
        Ok(crop) => crop,
        Err(error) => {
            tracing::warn!(
                source_type = candidate.source_type,
                source_id = candidate.source_id,
                ?error,
                "单张图片未得到可靠上半身结果，保存布局回退参数"
            );
            DetectedImageCrop {
                center_x: 0.5,
                center_y: if candidate.source_type == "person" {
                    0.3
                } else {
                    0.28
                },
                scale: 1.02,
                crop_left: None,
                crop_top: None,
                crop_width: None,
                crop_height: None,
                confidence: 0.0,
                detector_version: CROP_FALLBACK_VERSION.to_string(),
                image_url_hash: image_url_hash(&candidate.image_url),
            }
        }
    };
    let request = UpsertBangumiImageCrop {
        center_x: detected.center_x,
        center_y: detected.center_y,
        scale: detected.scale,
        crop_left: detected.crop_left,
        crop_top: detected.crop_top,
        crop_width: detected.crop_width,
        crop_height: detected.crop_height,
        confidence: detected.confidence,
        detector_version: detected.detector_version,
        image_url_hash: Some(detected.image_url_hash),
    };
    persist_image_crop(state, candidate.source_type, candidate.source_id, &request).await?;
    Ok(())
}

/// 将归一化结果按 Bangumi 来源唯一键幂等写入数据库。
async fn persist_image_crop(
    state: &SharedState,
    source_type: &str,
    source_id: i64,
    request: &UpsertBangumiImageCrop,
) -> AppResult<BangumiImageCrop> {
    validate_crop(source_type, request)?;
    let collection = state
        .db
        .collection::<BangumiImageCrop>("bangumi_image_crops");
    collection
        .create_index(
            IndexModel::builder()
                .keys(doc! { "sourceType": 1, "sourceId": 1 })
                .options(
                    IndexOptions::builder()
                        .name("bangumi_crop_source_unique".to_string())
                        .unique(true)
                        .build(),
                )
                .build(),
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let filter = doc! { "sourceType": source_type, "sourceId": source_id };
    collection
        .update_one(
            filter.clone(),
            doc! {
                "$set": {
                    "centerX": request.center_x,
                    "centerY": request.center_y,
                    "scale": request.scale,
                    "cropLeft": request.crop_left,
                    "cropTop": request.crop_top,
                    "cropWidth": request.crop_width,
                    "cropHeight": request.crop_height,
                    "confidence": request.confidence,
                    "detectorVersion": &request.detector_version,
                    "imageUrlHash": &request.image_url_hash,
                    "updatedAt": bson::DateTime::now(),
                },
                "$setOnInsert": {
                    "_id": ObjectId::new(),
                    "sourceType": source_type,
                    "sourceId": source_id,
                },
            },
        )
        .upsert(true)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    collection
        .find_one(filter)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::Internal("Crop was not found after upsert".to_string()))
}

/// 拒绝会导致图片移出视窗或产生异常放大的非法检测结果。
fn validate_crop(source_type: &str, request: &UpsertBangumiImageCrop) -> AppResult<()> {
    if !ALLOWED_SOURCE_TYPES.contains(&source_type) {
        return Err(AppError::BadRequest(
            "Unsupported Bangumi source type".to_string(),
        ));
    }
    if !(0.0..=1.0).contains(&request.center_x)
        || !(0.0..=1.0).contains(&request.center_y)
        || !(1.0..=4.0).contains(&request.scale)
        || !(0.0..=1.0).contains(&request.confidence)
        || request.detector_version.trim().is_empty()
    {
        return Err(AppError::BadRequest(
            "Invalid Bangumi crop parameters".to_string(),
        ));
    }
    let crop_values = [
        request.crop_left,
        request.crop_top,
        request.crop_width,
        request.crop_height,
    ];
    if crop_values.iter().any(Option::is_some)
        && (!crop_values.iter().all(Option::is_some)
            || request
                .crop_left
                .is_some_and(|value| !(0.0..=1.0).contains(&value))
            || request
                .crop_top
                .is_some_and(|value| !(0.0..=1.0).contains(&value))
            || request
                .crop_width
                .is_some_and(|value| !(0.0..=1.0).contains(&value))
            || request
                .crop_height
                .is_some_and(|value| !(0.0..=1.0).contains(&value))
            || request
                .crop_left
                .zip(request.crop_width)
                .is_some_and(|(left, width)| left + width > 1.000_001)
            || request
                .crop_top
                .zip(request.crop_height)
                .is_some_and(|(top, height)| top + height > 1.000_001))
    {
        return Err(AppError::BadRequest(
            "Invalid Bangumi crop rectangle".to_string(),
        ));
    }
    Ok(())
}

/// 组合来源类型与官方 ID，避免角色和现实人物之间发生键碰撞。
fn crop_key(source_type: &str, source_id: i64) -> String {
    format!("{source_type}:{source_id}")
}

#[cfg(test)]
mod tests {
    use super::{BangumiLibrarySection, library_path};

    /// 作品状态筛选必须映射到官方 type 参数，分页参数由请求函数追加。
    #[test]
    fn builds_media_library_path_with_upstream_status() {
        let path = library_path("test user", BangumiLibrarySection::Anime, Some(3)).ok();
        assert_eq!(
            path.as_deref(),
            Some("/users/test%20user/collections?subject_type=2&type=3")
        );
    }

    /// 非法收藏状态应在访问上游前被拒绝。
    #[test]
    fn rejects_invalid_collection_status() {
        assert!(library_path("test", BangumiLibrarySection::Book, Some(6)).is_err());
    }
}
