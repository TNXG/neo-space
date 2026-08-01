//! Bangumi 虚构角色与现实人物的上半身检测及裁切计算。

use std::{
    env,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
};

use image::GenericImageView;
use sha2::{Digest, Sha256};
use tokio::io::AsyncWriteExt;
use ultralytics_inference::{InferenceConfig, YOLOModel};

use crate::error::{AppError, AppResult};

const ANIME_MODEL_URL: &str = "https://huggingface.co/deepghs/anime_head_detection/resolve/main/head_detect_v2.0_n_yv11/model.onnx";
const ANIME_MODEL_FILE_NAME: &str = "deepghs-anime-head-v2-yolo11n.onnx";
const ANIME_DETECTOR_VERSION: &str =
    "deepghs/anime_head_detection@head_detect_v2.0_n_yv11+portrait-4x5-v5";
const PERSON_MODEL_URL: &str =
    "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo11n-pose.onnx";
const PERSON_MODEL_FILE_NAME: &str = "yolo11n-pose.onnx";
const PERSON_DETECTOR_VERSION: &str = "ultralytics/yolo11n-pose@v8.4.0+portrait-4x5-v5";
const MAX_IMAGE_BYTES: u64 = 15 * 1024 * 1024;
const PORTRAIT_ASPECT_RATIO: f64 = 4.0 / 5.0;
const DOWNLOAD_PROGRESS_BAR_WIDTH: usize = 20;
const DOWNLOAD_PROGRESS_STEP_PERCENT: u64 = 5;
const UNKNOWN_DOWNLOAD_PROGRESS_STEP_BYTES: u64 = 1024 * 1024;

static ANIME_HEAD_MODEL: OnceLock<Mutex<Option<YOLOModel>>> = OnceLock::new();
static PERSON_POSE_MODEL: OnceLock<Mutex<Option<YOLOModel>>> = OnceLock::new();

/// 在后端开始监听端口前准备人物裁切所需的两个 ONNX 模型。
pub async fn prepare_bangumi_models(http_client: &reqwest::Client) -> AppResult<()> {
    let cache_root = model_cache_root();
    tokio::fs::create_dir_all(&cache_root)
        .await
        .map_err(|error| AppError::Internal(format!("Failed to create model cache: {error}")))?;

    let anime_model_path = cache_root.join(ANIME_MODEL_FILE_NAME);
    ensure_cached_file(
        http_client,
        ANIME_MODEL_URL,
        &anime_model_path,
        None,
        Some("Bangumi 动漫头部模型"),
    )
    .await?;
    ensure_channels_metadata(&anime_model_path).await?;

    let person_model_path = cache_root.join(PERSON_MODEL_FILE_NAME);
    ensure_cached_file(
        http_client,
        PERSON_MODEL_URL,
        &person_model_path,
        None,
        Some("Bangumi 人体姿态模型"),
    )
    .await?;
    Ok(())
}

/// 模型检测后得到的归一化裁切参数。
#[derive(Debug, Clone)]
pub struct DetectedImageCrop {
    pub center_x: f64,
    pub center_y: f64,
    pub scale: f64,
    pub crop_left: Option<f64>,
    pub crop_top: Option<f64>,
    pub crop_width: Option<f64>,
    pub crop_height: Option<f64>,
    pub confidence: f64,
    pub detector_version: String,
    pub image_url_hash: String,
}

/// 生成用于判断上游图片是否变化的稳定摘要。
#[must_use]
pub fn image_url_hash(image_url: &str) -> String {
    hex::encode(Sha256::digest(image_url.as_bytes()))
}

/// 下载受信任的 Bangumi 图片并调用动漫专用 YOLO11 头部模型。
pub async fn detect_anime_upper_body(
    http_client: &reqwest::Client,
    image_url: &str,
) -> AppResult<DetectedImageCrop> {
    validate_image_url(image_url)?;
    let cache_root = model_cache_root();
    tokio::fs::create_dir_all(&cache_root)
        .await
        .map_err(|error| AppError::Internal(format!("Failed to create model cache: {error}")))?;

    let model_path = cache_root.join(ANIME_MODEL_FILE_NAME);
    ensure_cached_file(
        http_client,
        ANIME_MODEL_URL,
        &model_path,
        None,
        Some("Bangumi 动漫头部模型"),
    )
    .await?;
    ensure_channels_metadata(&model_path).await?;

    let image_url_hash = image_url_hash(image_url);
    let image_extension = trusted_image_extension(image_url);
    let image_path = cache_root.join(format!("bangumi-image-{image_url_hash}.{image_extension}"));
    ensure_cached_file(
        http_client,
        image_url,
        &image_path,
        Some(MAX_IMAGE_BYTES),
        None,
    )
    .await?;

    tokio::task::spawn_blocking(move || {
        detect_anime_from_file(&model_path, &image_path, image_url_hash)
    })
    .await
    .map_err(|error| AppError::Internal(format!("Bangumi detector task failed: {error}")))?
}

/// 兼容较早 Ultralytics 导出器缺少 channels 元数据的 ONNX 模型。
async fn ensure_channels_metadata(model_path: &Path) -> AppResult<()> {
    const CHANNELS_KEY: &[u8] = b"channels";
    const CHANNELS_METADATA: &[u8] = b"\x72\x0d\x0a\x08channels\x12\x01\x33";

    let mut model_bytes = tokio::fs::read(model_path)
        .await
        .map_err(|error| AppError::Internal(format!("Failed to inspect anime model: {error}")))?;
    if model_bytes
        .windows(CHANNELS_KEY.len())
        .any(|window| window == CHANNELS_KEY)
    {
        return Ok(());
    }

    // ModelProto 的 metadata_props 是字段 14；追加合法的 StringStringEntry 不会改写模型图。
    model_bytes.extend_from_slice(CHANNELS_METADATA);
    let temporary_path = model_path.with_extension("patched");
    tokio::fs::write(&temporary_path, model_bytes)
        .await
        .map_err(|error| AppError::Internal(format!("Failed to patch anime model: {error}")))?;
    tokio::fs::rename(&temporary_path, model_path)
        .await
        .map_err(|error| AppError::Internal(format!("Failed to finalize anime model: {error}")))?;
    Ok(())
}

/// 下载现实人物图片，并通过人体姿态关键点锁定头肩与上半身。
pub async fn detect_person_upper_body(
    http_client: &reqwest::Client,
    image_url: &str,
) -> AppResult<DetectedImageCrop> {
    validate_image_url(image_url)?;
    let cache_root = model_cache_root();
    tokio::fs::create_dir_all(&cache_root)
        .await
        .map_err(|error| AppError::Internal(format!("Failed to create model cache: {error}")))?;

    let model_path = cache_root.join(PERSON_MODEL_FILE_NAME);
    ensure_cached_file(
        http_client,
        PERSON_MODEL_URL,
        &model_path,
        None,
        Some("Bangumi 人体姿态模型"),
    )
    .await?;

    let image_url_hash = image_url_hash(image_url);
    let image_extension = trusted_image_extension(image_url);
    let image_path = cache_root.join(format!("bangumi-image-{image_url_hash}.{image_extension}"));
    ensure_cached_file(
        http_client,
        image_url,
        &image_path,
        Some(MAX_IMAGE_BYTES),
        None,
    )
    .await?;

    tokio::task::spawn_blocking(move || {
        detect_person_from_file(&model_path, &image_path, image_url_hash)
    })
    .await
    .map_err(|error| AppError::Internal(format!("Bangumi pose detector task failed: {error}")))?
}

/// 保留受支持的真实图片扩展名，确保图像解码器可以正确识别缓存文件。
fn trusted_image_extension(image_url: &str) -> &'static str {
    let extension = image_url
        .split('?')
        .next()
        .and_then(|path| path.rsplit('.').next())
        .unwrap_or_default();
    match extension.to_ascii_lowercase().as_str() {
        "png" => "png",
        "webp" => "webp",
        "jpeg" => "jpeg",
        _ => "jpg",
    }
}

/// 只允许读取 Bangumi 官方图片域名，避免该管理接口成为任意 URL 代理。
fn validate_image_url(image_url: &str) -> AppResult<()> {
    let parsed = reqwest::Url::parse(image_url)
        .map_err(|_| AppError::BadRequest("Invalid Bangumi image URL".to_string()))?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https" || (host != "bgm.tv" && !host.ends_with(".bgm.tv")) {
        return Err(AppError::BadRequest(
            "Bangumi image URL must use an official HTTPS host".to_string(),
        ));
    }
    Ok(())
}

/// 返回可由部署环境覆盖的持久化模型缓存目录。
fn model_cache_root() -> PathBuf {
    env::var_os("BANGUMI_MODEL_CACHE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("./.cache/models/bangumi"))
}

/// 将模型或图片下载到缓存；临时文件写完后再原子替换，避免并发读到半文件。
async fn ensure_cached_file(
    http_client: &reqwest::Client,
    url: &str,
    destination: &Path,
    max_bytes: Option<u64>,
    progress_label: Option<&str>,
) -> AppResult<()> {
    if tokio::fs::try_exists(destination).await.unwrap_or(false) {
        if let Some(label) = progress_label {
            tracing::info!(model = label, path = %destination.display(), "模型缓存已就绪");
        }
        return Ok(());
    }

    let mut response = http_client
        .get(url)
        .send()
        .await
        .map_err(|error| AppError::Internal(format!("Bangumi asset download failed: {error}")))?
        .error_for_status()
        .map_err(|error| AppError::Internal(format!("Bangumi asset returned an error: {error}")))?;
    if max_bytes.is_some_and(|limit| response.content_length().is_some_and(|size| size > limit)) {
        return Err(AppError::BadRequest(
            "Bangumi image is too large".to_string(),
        ));
    }

    let temporary_path = destination.with_extension("download");
    let mut temporary_file = tokio::fs::File::create(&temporary_path)
        .await
        .map_err(|error| AppError::Internal(format!("Failed to create Bangumi cache: {error}")))?;
    let total_bytes = response.content_length();
    let mut downloaded_bytes = 0_u64;
    let mut next_progress = 0_u64;
    if let Some(label) = progress_label {
        report_download_progress(label, downloaded_bytes, total_bytes, &mut next_progress);
    }

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| AppError::Internal(format!("Failed to read Bangumi asset: {error}")))?
    {
        downloaded_bytes = downloaded_bytes.saturating_add(chunk.len() as u64);
        if max_bytes.is_some_and(|limit| downloaded_bytes > limit) {
            drop(temporary_file);
            let _ = tokio::fs::remove_file(&temporary_path).await;
            return Err(AppError::BadRequest(
                "Bangumi image is too large".to_string(),
            ));
        }
        temporary_file.write_all(&chunk).await.map_err(|error| {
            AppError::Internal(format!("Failed to cache Bangumi asset: {error}"))
        })?;
        if let Some(label) = progress_label {
            report_download_progress(label, downloaded_bytes, total_bytes, &mut next_progress);
        }
    }
    temporary_file
        .flush()
        .await
        .map_err(|error| AppError::Internal(format!("Failed to flush Bangumi cache: {error}")))?;
    drop(temporary_file);
    tokio::fs::rename(&temporary_path, destination)
        .await
        .map_err(|error| {
            AppError::Internal(format!("Failed to finalize Bangumi cache: {error}"))
        })?;
    if let Some(label) = progress_label {
        tracing::info!(
            model = label,
            size = %format_bytes(downloaded_bytes),
            path = %destination.display(),
            "模型下载完成"
        );
    }
    Ok(())
}

/// 以固定宽度文本条输出下载进度，兼容 Docker 等非交互式日志环境。
fn report_download_progress(
    label: &str,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    next_progress: &mut u64,
) {
    if let Some(total_bytes) = total_bytes.filter(|total| *total > 0) {
        let percentage = downloaded_bytes
            .saturating_mul(100)
            .checked_div(total_bytes)
            .unwrap_or_default()
            .min(100);
        if percentage < *next_progress && downloaded_bytes < total_bytes {
            return;
        }
        tracing::info!(
            "{label} {} {:>3}% ({}/{})",
            render_progress_bar(percentage),
            percentage,
            format_bytes(downloaded_bytes),
            format_bytes(total_bytes),
        );
        *next_progress = percentage
            .saturating_div(DOWNLOAD_PROGRESS_STEP_PERCENT)
            .saturating_add(1)
            .saturating_mul(DOWNLOAD_PROGRESS_STEP_PERCENT);
        return;
    }

    if downloaded_bytes >= *next_progress {
        tracing::info!("{label} {} downloaded", format_bytes(downloaded_bytes),);
        *next_progress = downloaded_bytes.saturating_add(UNKNOWN_DOWNLOAD_PROGRESS_STEP_BYTES);
    }
}

/// 将百分比转换为适合日志输出的固定宽度进度条。
fn render_progress_bar(percentage: u64) -> String {
    let filled_width = usize::try_from(percentage.min(100))
        .unwrap_or(100)
        .saturating_mul(DOWNLOAD_PROGRESS_BAR_WIDTH)
        / 100;
    format!(
        "[{}{}]",
        "#".repeat(filled_width),
        "-".repeat(DOWNLOAD_PROGRESS_BAR_WIDTH.saturating_sub(filled_width)),
    )
}

/// 使用紧凑的二进制单位展示当前下载字节数。
fn format_bytes(bytes: u64) -> String {
    const KIB: f64 = 1024.0;
    const MIB: f64 = KIB * 1024.0;
    let bytes = bytes as f64;
    if bytes >= MIB {
        format!("{:.1} MiB", bytes / MIB)
    } else if bytes >= KIB {
        format!("{:.1} KiB", bytes / KIB)
    } else {
        format!("{bytes:.0} B")
    }
}

/// 选择画面中最主要的动漫头部，并由头框向下推导上半身取景区域。
fn detect_anime_from_file(
    model_path: &Path,
    image_path: &Path,
    image_url_hash: String,
) -> AppResult<DetectedImageCrop> {
    let model_slot = ANIME_HEAD_MODEL.get_or_init(|| Mutex::new(None));
    let mut model_guard = model_slot
        .lock()
        .map_err(|_| AppError::Internal("Bangumi detector lock was poisoned".to_string()))?;
    if model_guard.is_none() {
        let config = InferenceConfig::new()
            .with_confidence(0.35)
            .with_iou(0.6)
            .with_max_det(20)
            .with_threads(2);
        *model_guard = Some(
            YOLOModel::load_with_config(model_path, config).map_err(|error| {
                AppError::Internal(format!("Failed to load anime model: {error}"))
            })?,
        );
    }

    let model = model_guard
        .as_mut()
        .ok_or_else(|| AppError::Internal("Bangumi detector was not initialized".to_string()))?;
    let results = model
        .predict(image_path)
        .map_err(|error| AppError::Internal(format!("Anime head detection failed: {error}")))?;
    let result = results
        .first()
        .ok_or_else(|| AppError::BadRequest("No anime head was detected".to_string()))?;
    let boxes = result
        .boxes
        .as_ref()
        .filter(|boxes| !boxes.is_empty())
        .ok_or_else(|| AppError::BadRequest("No anime head was detected".to_string()))?;
    let normalized_boxes = boxes.xyxyn();
    let confidences = boxes.conf();
    let box_value = |row: usize, column: usize| {
        normalized_boxes
            .get((row, column))
            .copied()
            .unwrap_or_default()
    };
    let box_confidence = |row: usize| confidences.get(row).copied().unwrap_or_default();

    let detection_score = |index: usize| {
        let width = (box_value(index, 2) - box_value(index, 0)).max(0.0);
        let height = (box_value(index, 3) - box_value(index, 1)).max(0.0);
        let center_x = f32::midpoint(box_value(index, 0), box_value(index, 2));
        let center_y = f32::midpoint(box_value(index, 1), box_value(index, 3));
        let center_distance = ((center_x - 0.5).powi(2) + (center_y - 0.42).powi(2)).sqrt();
        box_confidence(index) * (width * height).sqrt() * (1.25 - center_distance.min(1.0))
    };
    let best_index = (0..boxes.len())
        .max_by(|left, right| detection_score(*left).total_cmp(&detection_score(*right)))
        .ok_or_else(|| AppError::BadRequest("No anime head was detected".to_string()))?;

    let head_left = box_value(best_index, 0) as f64;
    let head_top = box_value(best_index, 1) as f64;
    let head_right = box_value(best_index, 2) as f64;
    let head_bottom = box_value(best_index, 3) as f64;
    let head_width = (head_right - head_left).max(0.01);
    let head_height = (head_bottom - head_top).max(0.01);
    let head_center_x = f64::midpoint(head_left, head_right);

    // 以约 1.9 个头宽和 3.1 个头高聚焦头部至胸部，并为长发与侧身姿态保留余量。
    let crop_left = (head_center_x - head_width * 0.95).max(0.0);
    let crop_right = (head_center_x + head_width * 0.95).min(1.0);
    let crop_top = (head_top - head_height * 0.45).max(0.0);
    let crop_bottom = (head_bottom + head_height * 1.65).min(1.0);
    let crop = fit_crop_to_portrait(image_path, crop_left, crop_top, crop_right, crop_bottom)?;

    Ok(DetectedImageCrop {
        center_x: crop.center_x,
        center_y: crop.center_y,
        scale: crop.scale,
        crop_left: Some(crop.left),
        crop_top: Some(crop.top),
        crop_width: Some(crop.width),
        crop_height: Some(crop.height),
        confidence: box_confidence(best_index) as f64,
        detector_version: ANIME_DETECTOR_VERSION.to_string(),
        image_url_hash,
    })
}

/// 以 COCO 姿态的脸部、肩部和髋部关键点计算现实人物的上半身区域。
fn detect_person_from_file(
    model_path: &Path,
    image_path: &Path,
    image_url_hash: String,
) -> AppResult<DetectedImageCrop> {
    let model_slot = PERSON_POSE_MODEL.get_or_init(|| Mutex::new(None));
    let mut model_guard = model_slot
        .lock()
        .map_err(|_| AppError::Internal("Person pose detector lock was poisoned".to_string()))?;
    if model_guard.is_none() {
        let config = InferenceConfig::new()
            .with_confidence(0.3)
            .with_iou(0.6)
            .with_max_det(10)
            .with_threads(2);
        *model_guard = Some(
            YOLOModel::load_with_config(model_path, config).map_err(|error| {
                AppError::Internal(format!("Failed to load person pose model: {error}"))
            })?,
        );
    }

    let model = model_guard.as_mut().ok_or_else(|| {
        AppError::Internal("Person pose detector was not initialized".to_string())
    })?;
    let results = model
        .predict(image_path)
        .map_err(|error| AppError::Internal(format!("Person pose detection failed: {error}")))?;
    let result = results
        .first()
        .ok_or_else(|| AppError::BadRequest("No person pose was detected".to_string()))?;
    let keypoints = result
        .keypoints
        .as_ref()
        .filter(|keypoints| !keypoints.is_empty())
        .ok_or_else(|| AppError::BadRequest("No person pose was detected".to_string()))?;
    let normalized = keypoints.xyn();
    let confidences = keypoints.conf();
    let point_value = |pose_index: usize, keypoint: usize, axis: usize| {
        normalized
            .get((pose_index, keypoint, axis))
            .copied()
            .unwrap_or_default()
    };
    let point_confidence = |pose_index: usize, keypoint: usize| {
        confidences.as_ref().map_or(1.0, |values| {
            values
                .get((pose_index, keypoint))
                .copied()
                .unwrap_or_default()
        })
    };

    let pose_score = |pose_index: usize| {
        let confidence = [0, 1, 2, 5, 6]
            .iter()
            .map(|keypoint| point_confidence(pose_index, *keypoint))
            .sum::<f32>()
            / 5.0;
        let shoulder_width = (point_value(pose_index, 6, 0) - point_value(pose_index, 5, 0)).abs();
        confidence * shoulder_width.max(0.05)
    };
    let best_index = (0..keypoints.len())
        .max_by(|left, right| pose_score(*left).total_cmp(&pose_score(*right)))
        .ok_or_else(|| AppError::BadRequest("No person pose was detected".to_string()))?;

    let confidence_at = |keypoint: usize| point_confidence(best_index, keypoint);
    let visible_points = |indices: &[usize]| {
        indices
            .iter()
            .filter(|index| confidence_at(**index) >= 0.25)
            .map(|index| {
                (
                    point_value(best_index, *index, 0) as f64,
                    point_value(best_index, *index, 1) as f64,
                )
            })
            .collect::<Vec<_>>()
    };

    let face_points = visible_points(&[0, 1, 2, 3, 4]);
    let shoulder_points = visible_points(&[5, 6]);
    if face_points.is_empty() || shoulder_points.is_empty() {
        return Err(AppError::BadRequest(
            "Person face or shoulders were not detected".to_string(),
        ));
    }
    let face_center = average_point(&face_points);
    let shoulder_center = average_point(&shoulder_points);
    let shoulder_width =
        if let (Some(left), Some(right)) = (shoulder_points.first(), shoulder_points.get(1)) {
            (right.0 - left.0).abs()
        } else {
            (shoulder_center.1 - face_center.1).abs() * 1.8
        }
        .max(0.12);
    let torso_height = (shoulder_center.1 - face_center.1).abs().max(0.08);
    let hip_points = visible_points(&[11, 12]);
    let crop_bottom = if hip_points.is_empty() {
        shoulder_center.1 + torso_height * 3.2
    } else {
        average_point(&hip_points).1 + torso_height * 0.35
    }
    .min(1.0);
    let crop_top = (face_center.1 - torso_height * 0.9).max(0.0);
    let crop_left = (shoulder_center.0 - shoulder_width * 0.85).max(0.0);
    let crop_right = (shoulder_center.0 + shoulder_width * 0.85).min(1.0);
    let crop = fit_crop_to_portrait(image_path, crop_left, crop_top, crop_right, crop_bottom)?;

    Ok(DetectedImageCrop {
        center_x: crop.center_x,
        center_y: crop.center_y,
        scale: crop.scale,
        crop_left: Some(crop.left),
        crop_top: Some(crop.top),
        crop_width: Some(crop.width),
        crop_height: Some(crop.height),
        confidence: pose_score(best_index) as f64,
        detector_version: PERSON_DETECTOR_VERSION.to_string(),
        image_url_hash,
    })
}

/// 计算可见关键点的几何中心。
fn average_point(points: &[(f64, f64)]) -> (f64, f64) {
    let (x_sum, y_sum) = points
        .iter()
        .fold((0.0, 0.0), |(x, y), point| (x + point.0, y + point.1));
    (x_sum / points.len() as f64, y_sum / points.len() as f64)
}

/// 与前端人物卡片的 4:5 视窗对齐裁切框，同时尽量保留检测区域。
fn fit_crop_to_portrait(
    image_path: &Path,
    left: f64,
    top: f64,
    right: f64,
    bottom: f64,
) -> AppResult<PortraitCrop> {
    let image = image::open(image_path)
        .map_err(|error| AppError::Internal(format!("Failed to inspect Bangumi image: {error}")))?;
    let (source_width, source_height) = image.dimensions();
    let source_width = f64::from(source_width);
    let source_height = f64::from(source_height);

    let center_x = f64::midpoint(left, right).clamp(0.0, 1.0);
    let center_y = f64::midpoint(top, bottom).clamp(0.0, 1.0);
    let mut width = (right - left).clamp(0.08, 1.0);
    let mut height = (bottom - top).clamp(0.08, 1.0);
    let detected_height = height;
    let pixel_aspect = width * source_width / (height * source_height);

    if pixel_aspect > PORTRAIT_ASPECT_RATIO {
        height = (width * source_width / (PORTRAIT_ASPECT_RATIO * source_height)).min(1.0);
    } else {
        width = (height * source_height * PORTRAIT_ASPECT_RATIO / source_width).min(1.0);
    }

    // 若一条边已到原图极限，反向收紧另一条边，继续保证输出不会畸变。
    let fitted_pixel_aspect = width * source_width / (height * source_height);
    if fitted_pixel_aspect > PORTRAIT_ASPECT_RATIO {
        width = (height * source_height * PORTRAIT_ASPECT_RATIO / source_width).min(1.0);
    } else {
        height = (width * source_width / (PORTRAIT_ASPECT_RATIO * source_height)).min(1.0);
    }

    let crop_left = (center_x - width / 2.0).clamp(0.0, 1.0 - width);
    let crop_top = if height + f64::EPSILON < detected_height {
        // 超窄全身立绘会舍弃下半身；上缘必须保留头部及模型给出的安全留白。
        top.clamp(0.0, 1.0 - height)
    } else {
        (center_y - height / 2.0).clamp(0.0, 1.0 - height)
    };

    Ok(PortraitCrop {
        left: crop_left,
        top: crop_top,
        width,
        height,
        center_x: crop_left + width / 2.0,
        center_y: crop_top + height / 2.0,
        scale: (1.0 / width.min(height)).clamp(1.0, 4.0),
    })
}

/// 已经适配人物卡片宽高比的归一化裁切矩形。
struct PortraitCrop {
    left: f64,
    top: f64,
    width: f64,
    height: f64,
    center_x: f64,
    center_y: f64,
    scale: f64,
}

#[cfg(test)]
mod tests {
    use super::{format_bytes, render_progress_bar};

    #[test]
    fn renders_bounded_download_progress_bar() {
        assert_eq!(render_progress_bar(0), "[--------------------]");
        assert_eq!(render_progress_bar(50), "[##########----------]");
        assert_eq!(render_progress_bar(120), "[####################]");
    }

    #[test]
    fn formats_downloaded_bytes_compactly() {
        assert_eq!(format_bytes(512), "512 B");
        assert_eq!(format_bytes(1536), "1.5 KiB");
        assert_eq!(format_bytes(2 * 1024 * 1024), "2.0 MiB");
    }
}
