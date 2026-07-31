//! Bangumi 图片智能裁切参数。

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::serializers::{deserialize_id_to_string, serialize_datetime};

/// 使用归一化坐标保存检测结果，避免与某个固定缩略图尺寸耦合。
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BangumiImageCrop {
    #[serde(rename = "_id", deserialize_with = "deserialize_id_to_string")]
    #[schema(value_type = String)]
    pub id: String,
    pub source_type: String,
    pub source_id: i64,
    pub center_x: f64,
    pub center_y: f64,
    pub scale: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crop_left: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crop_top: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crop_width: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub crop_height: Option<f64>,
    pub confidence: f64,
    pub detector_version: String,
    pub image_url_hash: Option<String>,
    #[serde(serialize_with = "serialize_datetime")]
    #[schema(value_type = String)]
    pub updated_at: bson::DateTime,
}

/// 检测服务或博主人工校正后提交的裁切参数。
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpsertBangumiImageCrop {
    pub center_x: f64,
    pub center_y: f64,
    pub scale: f64,
    pub crop_left: Option<f64>,
    pub crop_top: Option<f64>,
    pub crop_width: Option<f64>,
    pub crop_height: Option<f64>,
    pub confidence: f64,
    pub detector_version: String,
    pub image_url_hash: Option<String>,
}

/// 博主主动触发动漫图片检测时提交的来源信息。
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DetectBangumiImageCrop {
    pub source_type: String,
    pub source_id: i64,
    pub image_url: String,
}
