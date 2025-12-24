//! 创建评论路由

use mongodb::bson::{doc, oid::ObjectId, DateTime};
use rocket::serde::json::Json;
use rocket::{http::Status, post, State};
use std::str::FromStr;

use crate::config::OAuthConfig;
use crate::guards::{OptionalAuthGuard, ClientIp};
use crate::models::{ApiResponse, Comment, CommentState, CreateCommentRequest, ResponseStatus};
use crate::services::{verify_turnstile, AccountRepository, CommentService, IpService, ReaderRepository, SpamDetector};

/**
 * POST /api/comments
 * 创建新评论
 *
 * 支持两种模式：
 * 1. 匿名评论：必须提供 author 和 mail，需要通过 Turnstile 验证
 * 2. 登录评论：通过 JWT 获取用户信息，author 和 mail 可选，无需 Turnstile
 *
 * AI 垃圾检测采用异步模式：
 * - 评论先以"待审核"状态存入数据库，立即返回成功
 * - 后台异步调用 AI 进行审核，审核完成后更新状态
 */
#[post("/", data = "<request>")]
pub async fn create_comment(
    db: &State<mongodb::Database>,
    oauth_config: &State<OAuthConfig>,
    ip_service: &State<Option<IpService>>,
    auth: OptionalAuthGuard,
    client_ip: ClientIp,
    request: Json<CreateCommentRequest>,
) -> Result<Json<ApiResponse<Comment>>, Status> {
    let comment_service = CommentService::new(db.inner());
    let reader_repo = ReaderRepository::new(db.inner());
    let collection = db.collection::<Comment>("comments");

    // 获取客户端 IP 和地理位置
    let ip_address = client_ip.0;
    let location = ip_service.as_ref().and_then(|service| service.search_simple(&ip_address));
    
    log::info!("收到评论请求 - IP: {}, 位置: {:?}", ip_address, location);

    // 确定作者信息和头像
    let (author, mail, avatar_url, source, _reader_id) = if let Some(user_id) = auth.user_id {
        // 已登录用户：从 Reader 获取信息，无需 Turnstile 验证码
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
                
                // 查询用户绑定的 OAuth 提供商，确定 source
                let account_repo = AccountRepository::new(db.inner());
                let source = match account_repo.find_by_user_id(user_id).await {
                    Ok(accounts) => {
                        let providers: Vec<&str> = accounts.iter().map(|a| a.provider.as_str()).collect();
                        let has_github = providers.contains(&"github");
                        let has_qq = providers.contains(&"qq");
                        
                        match (has_github, has_qq) {
                            (true, false) => Some("from_oauth_github".to_string()),
                            (false, true) => Some("from_oauth_qq".to_string()),
                            (true, true) => Some("from_oauth_both".to_string()),
                            (false, false) => Some("oauth".to_string()), // 兜底
                        }
                    }
                    Err(e) => {
                        log::warn!("查询用户 OAuth 账号失败: {}", e);
                        Some("oauth".to_string())
                    }
                };
                
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
        // 未登录用户：必须提供 author 和 mail，并进行 Turnstile 验证
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

        // 验证 Turnstile token（仅匿名用户需要）
        let turnstile_token = match &request.turnstile_token {
            Some(token) if !token.trim().is_empty() => token,
            _ => {
                return Ok(Json(ApiResponse {
                    code: 400,
                    status: ResponseStatus::Failed,
                    message: "请完成人机验证".to_string(),
                    data: CommentService::empty_comment(),
                }));
            }
        };

        match verify_turnstile(turnstile_token, &oauth_config.turnstile_secret).await {
            Ok(true) => {
                log::info!("Turnstile 验证通过");
            }
            Ok(false) => {
                return Ok(Json(ApiResponse {
                    code: 400,
                    status: ResponseStatus::Failed,
                    message: "人机验证失败，请重试".to_string(),
                    data: CommentService::empty_comment(),
                }));
            }
            Err(e) => {
                log::error!("Turnstile 验证错误: {}", e);
                return Ok(Json(ApiResponse {
                    code: 500,
                    status: ResponseStatus::Failed,
                    message: format!("验证服务异常: {}", e),
                    data: CommentService::empty_comment(),
                }));
            }
        }

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
    let key = match comment_service
        .generate_comment_key(ref_oid, &request.ref_type, parent_oid)
        .await
    {
        Ok(key) => key,
        Err(e) => {
            eprintln!("Failed to generate comment key: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    // 获取当前评论索引
    let comments_index = match comment_service
        .get_comment_index(ref_oid, &request.ref_type)
        .await
    {
        Ok(index) => index,
        Err(e) => {
            eprintln!("Failed to get comment index: {}", e);
            return Err(Status::InternalServerError);
        }
    };

    // 检查是否启用 AI 审核，决定初始状态
    let ai_review_enabled = SpamDetector::is_ai_review_enabled(db.inner()).await;
    let initial_state = if ai_review_enabled {
        CommentState::PENDING // 待审核
    } else {
        CommentState::UNREAD // 未读+正常
    };

    // 创建评论
    let comment = Comment {
        id: None,
        r#ref: ref_oid,
        ref_type: request.ref_type.clone(),
        author: author.clone(),
        mail: mail.clone(),
        text: request.text.clone(),
        state: initial_state,
        children: Some(vec![]),
        comments_index,
        key,
        ip: Some(ip_address.clone()),
        agent: None,
        pin: false,
        is_whispers: false,
        source,
        avatar: Some(avatar_url),
        created: DateTime::now(),
        location,
        url: request.url.clone(),
        parent: parent_oid,
        ua: request.ua.clone(),
    };

    match collection.insert_one(&comment).await {
        Ok(result) => {
            let mut created_comment = comment.clone();
            let comment_id = match result.inserted_id.as_object_id() {
                Some(id) => id,
                None => {
                    log::error!("Failed to get ObjectId from insert result");
                    return Err(Status::InternalServerError);
                }
            };
            created_comment.id = Some(comment_id);

            // 如果是回复，更新父评论的 children 字段
            if let Some(parent_id) = parent_oid {
                let _ = comment_service
                    .update_parent_children(parent_id, comment_id)
                    .await;
            }

            // 如果启用了 AI 审核，启动异步审核任务
            if ai_review_enabled {
                let db_clone = db.inner().clone();
                let text_clone = request.text.clone();
                let author_clone = author.clone();
                let mail_clone = mail.clone();

                // 使用 tokio::spawn 启动异步任务
                tokio::spawn(async move {
                    SpamDetector::review_async(
                        &db_clone,
                        comment_id,
                        &text_clone,
                        &author_clone,
                        &mail_clone,
                    )
                    .await;
                });

                log::info!("评论 {} 已创建，异步审核任务已启动", comment_id);
            }

            Ok(Json(ApiResponse {
                code: 201,
                status: ResponseStatus::Success,
                message: if ai_review_enabled {
                    "评论已提交，正在审核中".to_string()
                } else {
                    "评论发布成功".to_string()
                },
                data: created_comment,
            }))
        }
        Err(e) => {
            eprintln!("Failed to create comment: {}", e);
            Err(Status::InternalServerError)
        }
    }
}
