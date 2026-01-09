//! 创建评论路由

use mongodb::bson::{doc, oid::ObjectId, DateTime};
use rocket::serde::json::Json;
use rocket::{http::Status, post, State};

use crate::config::OAuthConfig;
use crate::guards::{ClientIp, OptionalAuthGuard};
use crate::models::{ApiResponse, Comment, CommentState, CreateCommentRequest};
use crate::repositories::{AccountRepository, ReaderRepository};
use crate::services::{verify_turnstile, CommentService, IpService, SpamDetector};
use crate::utils::db::parse_object_id;

/// 用户信息结构
#[allow(dead_code)]
struct UserInfo {
    author: String,
    mail: String,
    avatar_url: String,
    source: Option<String>,
    reader_id: Option<String>,
}

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
    ip_service: &State<IpService>,
    auth: OptionalAuthGuard,
    client_ip: ClientIp,
    request: Json<CreateCommentRequest>,
) -> Result<Json<ApiResponse<Comment>>, Status> {
    let comment_service = CommentService::new(db.inner());
    let reader_repo = ReaderRepository::new(db.inner());
    let collection = db.collection::<Comment>("comments");

    // 获取客户端 IP 和地理位置
    let ip_address = client_ip.0;
    let location = ip_service.get_location(&ip_address).await;

    log::info!("收到评论请求 - IP: {ip_address}, 位置: {location:?}");

    // 解析用户信息（已登录或匿名）
    let user_info = resolve_user_info(
        db.inner(),
        oauth_config.inner(),
        &reader_repo,
        &auth,
        &request,
    )
    .await?;

    // 验证必填字段
    validate_comment_data(&request)?;

    // 解析 ObjectId
    let ref_oid = parse_object_id(&request.r#ref)?;
    let parent_oid = parse_parent_id(&request.parent)?;

    // 生成评论 key
    let key = comment_service
        .generate_comment_key(ref_oid, &request.ref_type, parent_oid)
        .await
        .map_err(|e| {
            log::error!("生成评论 key 失败: {e}");
            Status::InternalServerError
        })?;

    // 获取评论索引
    let comments_index = comment_service
        .get_comment_index(ref_oid, &request.ref_type)
        .await
        .map_err(|e| {
            log::error!("获取评论索引失败: {e}");
            Status::InternalServerError
        })?;

    // 检查 AI 审核是否启用
    let ai_review_enabled = SpamDetector::is_ai_review_enabled(db.inner()).await;

    // 创建评论对象
    let comment = build_comment_object(
        &request,
        ref_oid,
        parent_oid,
        &user_info,
        comments_index,
        key,
        ip_address,
        location,
        ai_review_enabled,
    );

    // 插入评论并处理后续逻辑
    let (_comment_id, created_comment) = insert_and_process_comment(
        &collection,
        &comment_service,
        comment,
        parent_oid,
        ai_review_enabled,
        &db,
        &user_info,
        &request,
    )
    .await?;

    Ok(Json(ApiResponse::success_with_message(
        created_comment,
        if ai_review_enabled {
            "评论已提交，正在审核中"
        } else {
            "评论发布成功"
        }
        .to_string(),
    )))
}

/// 解析用户信息（已登录或匿名）
async fn resolve_user_info(
    db: &mongodb::Database,
    oauth_config: &OAuthConfig,
    reader_repo: &ReaderRepository,
    auth: &OptionalAuthGuard,
    request: &CreateCommentRequest,
) -> Result<UserInfo, Status> {
    if let Some(user_oid) = auth.user_id {
        // 已登录用户：从 Reader 获取信息
        resolve_logged_in_user(db, reader_repo, user_oid, request).await
    } else {
        // 匿名用户：需要 Turnstile 验证
        resolve_anonymous_user(oauth_config, reader_repo, request).await
    }
}

/// 解析已登录用户信息
async fn resolve_logged_in_user(
    db: &mongodb::Database,
    reader_repo: &ReaderRepository,
    user_oid: ObjectId,
    request: &CreateCommentRequest,
) -> Result<UserInfo, Status> {
    let user_id_str = user_oid.to_string();

    let reader = match reader_repo.find_by_id(user_oid).await {
        Ok(Some(reader)) => reader,
        Ok(None) => {
            log::warn!("用户 {user_id_str} 不存在");
            return Err(Status::Unauthorized);
        }
        Err(e) => {
            log::error!("查询用户失败: {e}");
            return Err(Status::InternalServerError);
        }
    };

    let author = request.author.clone().unwrap_or(reader.name.clone());
    let mail = request.mail.clone().unwrap_or(reader.email.clone());
    let avatar_url = if reader.image.is_empty() {
        CommentService::generate_avatar_url(&mail)
    } else {
        reader.image.clone()
    };

    // 查询用户绑定的 OAuth 提供商
    let account_repo = AccountRepository::new(db);
    let source = determine_oauth_source(&account_repo, &user_id_str).await;

    Ok(UserInfo {
        author,
        mail,
        avatar_url,
        source: Some(source),
        reader_id: Some(user_id_str),
    })
}

/// 解析匿名用户信息
async fn resolve_anonymous_user(
    oauth_config: &OAuthConfig,
    reader_repo: &ReaderRepository,
    request: &CreateCommentRequest,
) -> Result<UserInfo, Status> {
    // 验证必填字段
    let author = request
        .author
        .as_ref()
        .filter(|a| !a.trim().is_empty())
        .cloned()
        .ok_or_else(|| Status::BadRequest)?;

    let mail = request
        .mail
        .as_ref()
        .filter(|m| !m.trim().is_empty())
        .cloned()
        .ok_or_else(|| Status::BadRequest)?;

    // 验证 Turnstile token
    let turnstile_token = request
        .turnstile_token
        .as_ref()
        .filter(|t| !t.trim().is_empty())
        .ok_or_else(|| Status::BadRequest)?;

    match verify_turnstile(turnstile_token, &oauth_config.turnstile_secret).await {
        Ok(true) => {
            log::info!("Turnstile 验证通过");
        }
        Ok(false) => {
            log::warn!("Turnstile 验证失败");
            return Err(Status::BadRequest);
        }
        Err(e) => {
            log::error!("Turnstile 验证错误: {e}");
            return Err(Status::InternalServerError);
        }
    }

    // 查找或创建匿名 Reader
    let reader_id = reader_repo
        .find_or_create_anonymous(&author, &mail)
        .await
        .map_err(|e| {
            log::error!("创建匿名 Reader 失败: {e}");
            Status::InternalServerError
        })?;

    let avatar_url = CommentService::generate_avatar_url(&mail);

    Ok(UserInfo {
        author,
        mail,
        avatar_url,
        source: None,
        reader_id: Some(reader_id.to_string()),
    })
}

/// 确定 OAuth 提供商
async fn determine_oauth_source(account_repo: &AccountRepository, user_id: &str) -> String {
    // 将 user_id 转换为 ObjectId
    let user_object_id = match parse_object_id(user_id) {
        Ok(oid) => oid,
        Err(_) => {
            return "oauth".to_string();
        }
    };

    match account_repo.find_by_user_id(user_object_id).await {
        Ok(accounts) => {
            let providers: Vec<&str> = accounts.iter().map(|a| a.provider.as_str()).collect();
            let has_github = providers.contains(&"github");
            let has_qq = providers.contains(&"qq");

            match (has_github, has_qq) {
                (true, false) => "from_oauth_github".to_string(),
                (false, true) => "from_oauth_qq".to_string(),
                (true, true) => "from_oauth_both".to_string(),
                (false, false) => "oauth".to_string(),
            }
        }
        Err(e) => {
            log::warn!("查询用户 OAuth 账号失败: {e}");
            "oauth".to_string()
        }
    }
}

/// 验证评论数据
fn validate_comment_data(request: &CreateCommentRequest) -> Result<(), Status> {
    if request.text.trim().is_empty() {
        return Err(Status::BadRequest);
    }
    Ok(())
}

/// 解析父评论 ObjectId
fn parse_parent_id(parent: &Option<String>) -> Result<Option<ObjectId>, Status> {
    match parent {
        Some(parent_str) => parse_object_id(parent_str).map(Some),
        None => Ok(None),
    }
}

/// 启动 AI 审核异步任务
fn spawn_ai_review_task(
    db: mongodb::Database,
    comment_id: ObjectId,
    author: &str,
    mail: &str,
    text: &str,
) {
    let text_clone = text.to_string();
    let author_clone = author.to_string();
    let mail_clone = mail.to_string();

    tokio::spawn(async move {
        SpamDetector::review_async(&db, comment_id, &text_clone, &author_clone, &mail_clone).await;
    });

    log::info!("评论 {comment_id} 已创建，异步审核任务已启动");
}

/// 构建评论对象
fn build_comment_object(
    request: &CreateCommentRequest,
    ref_oid: ObjectId,
    parent_oid: Option<ObjectId>,
    user_info: &UserInfo,
    comments_index: i32,
    key: String,
    ip_address: String,
    location: Option<String>,
    ai_review_enabled: bool,
) -> Comment {
    let initial_state = if ai_review_enabled {
        CommentState::PENDING
    } else {
        CommentState::UNREAD
    };

    Comment {
        id: None,
        r#ref: ref_oid,
        ref_type: request.ref_type.clone(),
        author: user_info.author.clone(),
        mail: user_info.mail.clone(),
        text: request.text.clone(),
        state: initial_state,
        children: Some(vec![]),
        comments_index,
        key,
        ip: Some(ip_address),
        agent: None,
        pin: false,
        is_whispers: false,
        source: user_info.source.clone(),
        avatar: Some(user_info.avatar_url.clone()),
        created: DateTime::now(),
        location,
        url: request.url.clone(),
        parent: parent_oid,
        ua: request.ua.clone(),
    }
}

/// 插入评论并处理后续逻辑
async fn insert_and_process_comment(
    collection: &mongodb::Collection<Comment>,
    comment_service: &CommentService,
    comment: Comment,
    parent_oid: Option<ObjectId>,
    ai_review_enabled: bool,
    db: &State<mongodb::Database>,
    user_info: &UserInfo,
    request: &CreateCommentRequest,
) -> Result<(ObjectId, Comment), Status> {
    // 插入评论
    let insert_result = collection.insert_one(&comment).await.map_err(|e| {
        log::error!("插入评论失败: {e}");
        Status::InternalServerError
    })?;

    let comment_id = insert_result.inserted_id.as_object_id().ok_or_else(|| {
        log::error!("无法获取插入的 ObjectId");
        Status::InternalServerError
    })?;

    let mut created_comment = comment.clone();
    created_comment.id = Some(comment_id);

    // 如果是回复，更新父评论的 children
    if let Some(parent_id) = parent_oid {
        let _ = comment_service
            .update_parent_children(parent_id, comment_id)
            .await;
    }

    // 如果启用了 AI 审核，启动异步审核任务
    if ai_review_enabled {
        spawn_ai_review_task(
            db.inner().clone(),
            comment_id,
            &user_info.author,
            &user_info.mail,
            &request.text,
        );
    }

    Ok((comment_id, created_comment))
}
