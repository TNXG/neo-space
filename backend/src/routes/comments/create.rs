//! 创建评论路由

use mongodb::bson::{doc, oid::ObjectId, DateTime};
use rocket::serde::json::Json;
use rocket::{State, http::Status, post};
use std::str::FromStr;

use crate::models::{ApiResponse, Comment, CreateCommentRequest, ResponseStatus};
use crate::guards::OptionalAuthGuard;
use crate::services::CommentService;
use crate::services::ReaderRepository;

/**
 * POST /api/comments
 * 创建新评论
 * 
 * 支持两种模式：
 * 1. 匿名评论：必须提供 author 和 mail
 * 2. 登录评论：通过 JWT 获取用户信息，author 和 mail 可选
 */
#[post("/", data = "<request>")]
pub async fn create_comment(
    db: &State<mongodb::Database>,
    auth: OptionalAuthGuard,
    request: Json<CreateCommentRequest>,
) -> Result<Json<ApiResponse<Comment>>, Status> {
    let comment_service = CommentService::new(db.inner());
    let reader_repo = ReaderRepository::new(db.inner());
    let collection = db.collection::<Comment>("comments");

    // 确定作者信息和头像
    let (author, mail, avatar_url, source, _reader_id) = if let Some(user_id) = auth.user_id {
        // 已登录用户：从 Reader 获取信息
        match reader_repo.find_by_id(user_id).await {
            Ok(Some(reader)) => {
                let author = request.author.clone().unwrap_or(reader.name.clone());
                let mail = request.mail.clone().unwrap_or(reader.email.clone());
                // 优先使用 Reader 的头像，否则根据邮箱生成
                let avatar = if !reader.image.is_empty() {
                    reader.image.clone()
                } else {
                    CommentService::generate_avatar_url(&mail)
                };
                // 标记来源为 OAuth 登录
                let source = Some("oauth".to_string());
                (author, mail, avatar, source, Some(user_id))
            }
            Ok(None) => {
                log::warn!("用户 {} 不存在", user_id);
                return Ok(Json(ApiResponse {
                    code: 401,
                    status: ResponseStatus::Failed,
                    message: "用户不存在".to_string(),
                    data: CommentService::empty_comment(),
                }));
            }
            Err(e) => {
                log::error!("查询用户失败: {}", e);
                return Err(Status::InternalServerError);
            }
        }
    } else {
        // 未登录用户：必须提供 author 和 mail，并创建/查找 Reader
        let author = match &request.author {
            Some(a) if !a.trim().is_empty() => a.clone(),
            _ => {
                return Ok(Json(ApiResponse {
                    code: 400,
                    status: ResponseStatus::Failed,
                    message: "未登录用户必须提供昵称".to_string(),
                    data: CommentService::empty_comment(),
                }));
            }
        };
        let mail = match &request.mail {
            Some(m) if !m.trim().is_empty() => m.clone(),
            _ => {
                return Ok(Json(ApiResponse {
                    code: 400,
                    status: ResponseStatus::Failed,
                    message: "未登录用户必须提供邮箱".to_string(),
                    data: CommentService::empty_comment(),
                }));
            }
        };
        
        // 查找或创建匿名 Reader
        let reader_id = match reader_repo.find_or_create_anonymous(&author, &mail).await {
            Ok(id) => id,
            Err(e) => {
                log::error!("创建匿名 Reader 失败: {}", e);
                return Err(Status::InternalServerError);
            }
        };
        
        let avatar = CommentService::generate_avatar_url(&mail);
        (author, mail, avatar, None, Some(reader_id))
    };

    // 验证必填字段
    if request.text.trim().is_empty() {
        return Ok(Json(ApiResponse {
            code: 400,
            status: ResponseStatus::Failed,
            message: "评论内容不能为空".to_string(),
            data: CommentService::empty_comment(),
        }));
    }

    // 解析 ref ObjectId
    let ref_oid = match ObjectId::from_str(&request.r#ref) {
        Ok(oid) => oid,
        Err(_) => {
            return Ok(Json(ApiResponse {
                code: 400,
                status: ResponseStatus::Failed,
                message: "Invalid ref id".to_string(),
                data: CommentService::empty_comment(),
            }));
        }
    };

    // 解析 parent ObjectId（如果有）
    let parent_oid = if let Some(parent_str) = &request.parent {
        match ObjectId::from_str(parent_str) {
            Ok(oid) => Some(oid),
            Err(_) => None,
        }
    } else {
        None
    };

    // 生成 key
    let key = match comment_service.generate_comment_key(ref_oid, &request.ref_type, parent_oid).await {
        Ok(key) => key,
        Err(e) => {
            eprintln!("Failed to generate comment key: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    // 获取当前评论索引
    let comments_index = match comment_service.get_comment_index(ref_oid, &request.ref_type).await {
        Ok(index) => index,
        Err(e) => {
            eprintln!("Failed to get comment index: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    // 创建评论
    let comment = Comment {
        id: None,
        r#ref: ref_oid,
        ref_type: request.ref_type.clone(),
        author,
        mail,
        text: request.text.clone(),
        state: 1, // 默认审核通过
        children: Some(vec![]),
        comments_index,
        key,
        ip: None,
        agent: None,
        pin: false,
        is_whispers: false,
        source,
        avatar: Some(avatar_url),
        created: DateTime::now(),
        location: None,
        url: request.url.clone(),
        parent: parent_oid,
    };

    match collection.insert_one(&comment).await {
        Ok(result) => {
            let mut created_comment = comment;
            created_comment.id = Some(result.inserted_id.as_object_id().unwrap());

            // 如果是回复，更新父评论的 children 字段
            if let Some(parent_id) = parent_oid {
                let _ = comment_service.update_parent_children(parent_id, created_comment.id.unwrap()).await;
            }

            Ok(Json(ApiResponse {
                code: 201,
                status: ResponseStatus::Success,
                message: "Comment created successfully".to_string(),
                data: created_comment,
            }))
        }
        Err(e) => {
            eprintln!("Failed to create comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}