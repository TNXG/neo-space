//! 评论列表路由

use mongodb::bson::oid::ObjectId;
use rocket::serde::json::Json;
use rocket::{State, http::Status, get};
use std::str::FromStr;
use futures::stream::TryStreamExt;

use crate::models::{ApiResponse, CommentListResponse};
use crate::guards::OptionalAuthGuard;
use crate::services::CommentService;

/**
 * GET /api/comments?refId=xxx&refType=posts
 * 获取指定文章/页面/日记的评论列表
 * 根据用户身份过滤可见评论：
 * - 管理员：看到所有评论
 * - 普通用户：看到公开评论 + 自己的私密评论
 * - 匿名用户：只看到公开评论
 */
#[get("/?<ref_id>&<ref_type>")]
pub async fn list_comments(
    db: &State<mongodb::Database>,
    auth: OptionalAuthGuard,
    ref_id: String,
    ref_type: String,
) -> Result<Json<ApiResponse<CommentListResponse>>, Status> {
    let comment_service = CommentService::new(db.inner());

    // 解析 ObjectId
    let ref_oid = match ObjectId::from_str(&ref_id) {
        Ok(oid) => oid,
        Err(_) => {
            return Ok(ApiResponse::json_error_with_default(400, "Invalid ref_id".to_string()));
        }
    };

    // 构建查询过滤器
    let filter = match comment_service.build_visibility_filter(ref_oid, &ref_type, &auth).await {
        Ok(filter) => filter,
        Err(e) => {
            eprintln!("Failed to build visibility filter: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    // 查询评论
    let collection = db.collection::<crate::models::Comment>("comments");
    let mut cursor = match collection.find(filter).await {
        Ok(cursor) => cursor,
        Err(e) => {
            eprintln!("Failed to query comments: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    let mut all_comments = Vec::new();
    while let Some(comment) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error reading comment: {}", e);
        Status::InternalServerError
    })? {
        all_comments.push(comment);
    }

    let count = all_comments.len() as i64;

    // 收集所有唯一的邮箱，用于批量查询 Reader
    let emails: Vec<String> = all_comments
        .iter()
        .map(|c| c.mail.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    // 批量查询所有 Reader，构建邮箱到头像和站长身份的映射
    let (email_to_avatar, email_to_is_owner) = match comment_service.build_reader_mappings(emails).await {
        Ok(mappings) => mappings,
        Err(e) => {
            eprintln!("Failed to build reader mappings: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    // 构建树形结构
    let tree = CommentService::build_comment_tree(&all_comments, &email_to_avatar, &email_to_is_owner);

    Ok(Json(ApiResponse::success_with_message(
        CommentListResponse {
            comments: tree,
            count,
        },
        "Comments fetched successfully".to_string(),
    )))
}