//! Admin files: 仅暴露编辑器内联上传所需的最小 API。
//!
//! 出于安全与体量考量，前端不再提供「文件管理 / 孤儿图片」面板。
//! 这里只支持把文件落到本地 storage 目录并返回可访问 URL。

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppResult},
    models::*,
};
use axum::{
    extract::{Multipart, State},
    response::Json,
};
use serde::Serialize;
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;

#[derive(Debug, Serialize)]
pub struct UploadResult {
    pub url: String,
    pub name: String,
}

fn safe_filename(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_') {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    if out.is_empty() {
        format!("file-{}", chrono::Utc::now().timestamp_millis())
    } else {
        out
    }
}

fn unique_name(original: &str) -> String {
    let cleaned = safe_filename(original);
    let ts = chrono::Utc::now().timestamp_millis();
    if let Some(dot) = cleaned.rfind('.') {
        format!("{}-{}{}", &cleaned[..dot], ts, &cleaned[dot..])
    } else {
        format!("{}-{}", cleaned, ts)
    }
}

async fn ensure_dir(dir: &PathBuf) -> std::io::Result<()> {
    tokio::fs::create_dir_all(dir).await
}

/// POST /files/upload
pub async fn upload_file(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    mut multipart: Multipart,
) -> AppResult<Json<ApiResponse<UploadResult>>> {
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut kind = "file".to_string();

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("multipart: {}", e)))?
    {
        match field.name() {
            Some("file") => {
                file_name = field
                    .file_name()
                    .map(|s| s.to_string())
                    .or_else(|| Some(format!("upload-{}", chrono::Utc::now().timestamp())));
                let data = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("read field: {}", e)))?;
                file_bytes = Some(data.to_vec());
            }
            Some("type") => {
                kind = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("read type: {}", e)))?;
            }
            _ => {}
        }
    }

    let bytes = file_bytes.ok_or_else(|| AppError::BadRequest("缺少 file 字段".into()))?;
    let name = file_name.ok_or_else(|| AppError::BadRequest("缺少文件名".into()))?;
    let unique = unique_name(&name);

    let storage_dir: PathBuf = std::env::var("UPLOAD_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./storage/uploads"));
    let sub = match kind.as_str() {
        "image" => storage_dir.join("images"),
        _ => storage_dir.join("files"),
    };
    ensure_dir(&sub)
        .await
        .map_err(|e| AppError::Internal(format!("mkdir: {}", e)))?;

    let dest = sub.join(&unique);
    let mut f = tokio::fs::File::create(&dest)
        .await
        .map_err(|e| AppError::Internal(format!("write: {}", e)))?;
    f.write_all(&bytes)
        .await
        .map_err(|e| AppError::Internal(format!("write: {}", e)))?;
    f.flush()
        .await
        .map_err(|e| AppError::Internal(format!("flush: {}", e)))?;

    let public_base = std::env::var("UPLOAD_PUBLIC_URL")
        .unwrap_or_else(|_| format!("{}/api/static/uploads", state.config.backend_url));
    let folder = if kind == "image" { "images" } else { "files" };
    let url = format!("{}/{}/{}", public_base.trim_end_matches('/'), folder, unique);

    Ok(Json(ApiResponse::success(UploadResult {
        url,
        name: unique,
    })))
}
