//! Bangumi 图片裁切参数读取与持久化。

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppJson, AppResult},
    models::{ApiResponse, BangumiImageCrop, DetectBangumiImageCrop, UpsertBangumiImageCrop},
    services::bangumi_crop::{
        DetectedImageCrop, detect_anime_upper_body, detect_person_upper_body, image_url_hash,
    },
};
use axum::{
    extract::{Path, Query, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::{StreamExt, TryStreamExt, stream};
use mongodb::{IndexModel, options::IndexOptions};
use serde::Deserialize;
use serde_json::{Value, json};
use std::{collections::HashMap, env};

const ALLOWED_SOURCE_TYPES: [&str; 2] = ["character", "person"];
const BANGUMI_API_BASE_URL: &str = "https://api.bgm.tv/v0";
const BANGUMI_PAGE_SIZE: usize = 50;
const AUTO_DETECTION_CONCURRENCY: usize = 4;
const CROP_FALLBACK_VERSION: &str = "layout-fallback@3";
const CROP_GEOMETRY_VERSION: &str = "portrait-4x5-v5";

#[derive(Debug, Deserialize)]
struct BangumiPage {
    total: usize,
    data: Vec<Value>,
}

#[derive(Debug, Deserialize)]
pub struct BangumiLibraryQuery {
    username: Option<String>,
}

#[derive(Debug, Clone)]
struct CropCandidate {
    source_type: &'static str,
    source_id: i64,
    image_url: String,
}

/// GET /bangumi/library — 聚合官方收藏，并在每个条目中直接附带后端缓存的 crop。
pub async fn get_library(
    State(state): State<SharedState>,
    Query(query): Query<BangumiLibraryQuery>,
) -> AppResult<Json<ApiResponse<Value>>> {
    let username = env::var("BANGUMI_USERNAME")
        .ok()
        .or(query.username)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::NotFound("Bangumi username is not configured".to_string()))?;
    let encoded_username = urlencoding::encode(&username);
    let profile_path = format!("/users/{encoded_username}");
    let anime_path = format!("/users/{encoded_username}/collections?subject_type=2");
    let game_path = format!("/users/{encoded_username}/collections?subject_type=4");
    let book_path = format!("/users/{encoded_username}/collections?subject_type=1");
    let characters_path = format!("/users/{encoded_username}/collections/-/characters");
    let persons_path = format!("/users/{encoded_username}/collections/-/persons");

    let (profile, anime, game, book, characters, persons) = tokio::try_join!(
        fetch_bangumi_value(&state, &profile_path),
        fetch_all_bangumi_pages(&state, &anime_path),
        fetch_all_bangumi_pages(&state, &game_path),
        fetch_all_bangumi_pages(&state, &book_path),
        fetch_all_bangumi_pages(&state, &characters_path),
        fetch_all_bangumi_pages(&state, &persons_path),
    )?;

    let media = HashMap::from([("anime", anime), ("game", game), ("book", book)]);
    let mut people = HashMap::from([("characters", characters), ("persons", persons)]);
    let crop_map = resolve_library_crops(&state, &people).await?;

    if let Some(items) = people.get_mut("characters") {
        attach_crops(items, "character", &crop_map)?;
    }
    if let Some(items) = people.get_mut("persons") {
        attach_crops(items, "person", &crop_map)?;
    }

    Ok(Json(ApiResponse::success(json!({
        "profile": profile,
        "media": media,
        "characters": people.remove("characters").unwrap_or_default(),
        "persons": people.remove("persons").unwrap_or_default(),
    }))))
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

/// 遍历官方分页接口，确保后端返回完整收藏列表。
async fn fetch_all_bangumi_pages(state: &SharedState, path: &str) -> AppResult<Vec<Value>> {
    let mut items = Vec::new();
    let mut offset = 0;

    loop {
        let separator = if path.contains('?') { '&' } else { '?' };
        let response = state
            .http_client
            .get(format!(
                "{BANGUMI_API_BASE_URL}{path}{separator}limit={BANGUMI_PAGE_SIZE}&offset={offset}"
            ))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|error| AppError::Internal(format!("Bangumi request failed: {error}")))?
            .error_for_status()
            .map_err(|error| AppError::Internal(format!("Bangumi returned an error: {error}")))?
            .json::<BangumiPage>()
            .await
            .map_err(|error| AppError::Internal(format!("Invalid Bangumi page: {error}")))?;
        let total = response.total;
        offset += response.data.len();
        items.extend(response.data);
        if offset >= total || offset == 0 {
            break;
        }
    }
    Ok(items)
}

/// 只提取虚构角色和现实人物头像；作品封面不参与人物检测。
fn collect_crop_candidates(people: &HashMap<&str, Vec<Value>>) -> Vec<CropCandidate> {
    let mut candidates = Vec::new();
    if let Some(characters) = people.get("characters") {
        candidates.extend(
            characters
                .iter()
                .filter_map(|item| build_candidate(item, "character", "/id", "/images")),
        );
    }
    if let Some(persons) = people.get("persons") {
        candidates.extend(
            persons
                .iter()
                .filter_map(|item| build_candidate(item, "person", "/id", "/images")),
        );
    }
    candidates
}

/// 从一个官方条目中读取 ID 与优先级最高的图片 URL。
fn build_candidate(
    item: &Value,
    source_type: &'static str,
    id_pointer: &str,
    images_pointer: &str,
) -> Option<CropCandidate> {
    let source_id = item.pointer(id_pointer)?.as_i64()?;
    let images = item.pointer(images_pointer)?.as_object()?;
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

/// 优先使用同 URL 的数据库缓存，只对缺失或图片已变化的条目运行对应模型。
async fn resolve_library_crops(
    state: &SharedState,
    people: &HashMap<&str, Vec<Value>>,
) -> AppResult<HashMap<String, BangumiImageCrop>> {
    let existing_crops = load_crop_map(state).await?;
    let candidates = collect_crop_candidates(people);
    let pending = candidates.into_iter().filter(|candidate| {
        let key = crop_key(candidate.source_type, candidate.source_id);
        existing_crops.get(&key).is_none_or(|crop| {
            (crop.detector_version != CROP_FALLBACK_VERSION
                && (crop.crop_left.is_none() || automatic_crop_is_stale(crop)))
                || crop
                    .image_url_hash
                    .as_deref()
                    .is_some_and(|hash| hash != image_url_hash(&candidate.image_url))
        })
    });

    let detected = stream::iter(pending.map(|candidate| {
        let state = state.clone();
        async move { resolve_candidate_crop(&state, candidate).await }
    }))
    .buffer_unordered(AUTO_DETECTION_CONCURRENCY)
    .collect::<Vec<_>>()
    .await;

    let mut crop_map = existing_crops;
    for result in detected {
        let (key, crop) = result?;
        crop_map.insert(key, crop);
    }
    Ok(crop_map)
}

/// 仅升级模型自动生成的旧几何参数，避免覆盖博主手工校正的数据。
fn automatic_crop_is_stale(crop: &BangumiImageCrop) -> bool {
    let is_automatic = crop.detector_version.starts_with("deepghs/")
        || crop.detector_version.starts_with("ultralytics/")
        || crop.detector_version.starts_with("layout-fallback@");
    is_automatic && !crop.detector_version.ends_with(CROP_GEOMETRY_VERSION)
}

/// 运行与来源匹配的检测器；无法识别时保存明确版本的稳定回退，避免每次重复推理。
async fn resolve_candidate_crop(
    state: &SharedState,
    candidate: CropCandidate,
) -> AppResult<(String, BangumiImageCrop)> {
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
    let crop =
        persist_image_crop(state, candidate.source_type, candidate.source_id, &request).await?;
    Ok((crop_key(candidate.source_type, candidate.source_id), crop))
}

/// 一次读取全部缓存，避免为每个条目单独查询 MongoDB。
async fn load_crop_map(state: &SharedState) -> AppResult<HashMap<String, BangumiImageCrop>> {
    let mut cursor = state
        .db
        .collection::<BangumiImageCrop>("bangumi_image_crops")
        .find(doc! {})
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

/// 将缓存参数写回对应的官方 JSON 对象，前端无需再二次关联。
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

/// 组合来源类型与官方 ID，避免角色、人物和作品之间发生键碰撞。
fn crop_key(source_type: &str, source_id: i64) -> String {
    format!("{source_type}:{source_id}")
}

/// GET /bangumi/crops — 返回已完成检测或人工校正的全部归一化裁切参数。
pub async fn list_image_crops(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<Vec<BangumiImageCrop>>>> {
    let mut cursor = state
        .db
        .collection::<BangumiImageCrop>("bangumi_image_crops")
        .find(doc! {})
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut crops = Vec::new();
    while let Some(crop) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        crops.push(crop);
    }
    Ok(Json(ApiResponse::success(crops)))
}

/// PUT /bangumi/crops/{source_type}/{source_id} — 保存模型结果或人工校正参数。
pub async fn upsert_image_crop(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path((source_type, source_id)): Path<(String, i64)>,
    AppJson(request): AppJson<UpsertBangumiImageCrop>,
) -> AppResult<Json<ApiResponse<BangumiImageCrop>>> {
    validate_crop(&source_type, &request)?;
    let crop = persist_image_crop(&state, &source_type, source_id, &request).await?;
    Ok(Json(ApiResponse::success(crop)))
}

/// POST /bangumi/crops/detect — 由博主触发匹配来源类型的上半身检测并保存结果。
pub async fn detect_image_crop(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppJson(request): AppJson<DetectBangumiImageCrop>,
) -> AppResult<Json<ApiResponse<BangumiImageCrop>>> {
    let detected = match request.source_type.as_str() {
        "character" => detect_anime_upper_body(&state.http_client, &request.image_url).await?,
        "person" => detect_person_upper_body(&state.http_client, &request.image_url).await?,
        _ => {
            return Err(AppError::BadRequest(
                "Unsupported Bangumi source type".to_string(),
            ));
        }
    };
    let crop_request = UpsertBangumiImageCrop {
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
    let crop = persist_image_crop(
        &state,
        &request.source_type,
        request.source_id,
        &crop_request,
    )
    .await?;
    Ok(Json(ApiResponse::success(crop)))
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
                "$setOnInsert": { "_id": ObjectId::new(), "sourceType": source_type, "sourceId": source_id },
            },
        )
        .upsert(true)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    let crop = collection
        .find_one(filter)
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .ok_or_else(|| AppError::Internal("Crop was not found after upsert".to_string()))?;
    Ok(crop)
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
