//! 封面图片缓存文件服务

use rocket::fs::NamedFile;
use rocket::http::ContentType;
use std::path::PathBuf;

/// 获取封面图片
#[get("/<filename>")]
pub async fn get_artwork(filename: &str) -> Option<(ContentType, NamedFile)> {
    let path = PathBuf::from("./cache/artworks").join(filename);

    // 确定 Content-Type
    let content_type = if filename.ends_with(".png") {
        ContentType::PNG
    } else if filename.ends_with(".webp") {
        ContentType::WEBP
    } else if filename.ends_with(".gif") {
        ContentType::GIF
    } else {
        ContentType::JPEG
    };

    NamedFile::open(path).await.ok().map(|f| (content_type, f))
}
