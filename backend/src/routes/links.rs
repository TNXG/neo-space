use futures::stream::TryStreamExt;
use log::error;
use mongodb::bson::{doc, oid::ObjectId};
use mongodb::Database;
use rocket::{http::Status, serde::json::Json, State};

use crate::db_find_one;
use crate::infrastructure::send_verification_email;
use crate::integrations::status::link_health::LinkWithHealth;
use crate::integrations::LinkHealthService;
use crate::models::{ApiResponse, Link, LinkApplyRequest, LinkState, Pagination};
use crate::services::VerificationService;
use crate::utils::parse_object_id;

/// 发送验证码请求
#[derive(Debug, serde::Deserialize, utoipa::ToSchema)]
pub struct SendCodeRequest {
    /// 邮箱地址
    pub email: String,
}

/// List approved friend links with pagination (含健康状态)
#[utoipa::path(
    get,
    path = "/api/links",
    params(
        ("page" = Option<i64>, Query, description = "页码，默认为1"),
        ("size" = Option<i64>, Query, description = "每页大小，默认为50，最大100")
    ),
    responses(
        (status = 200, description = "成功获取友链列表", body = ApiResponse<LinkWithHealthResponse>),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "友链管理"
)]
#[get("/links?<page>&<size>")]
pub async fn list_links(
    db: &State<Database>,
    health_service: &State<LinkHealthService>,
    page: Option<i64>,
    size: Option<i64>,
) -> Result<Json<ApiResponse<LinkWithHealthResponse>>, Status> {
    let page = page.unwrap_or(1).max(1);
    let size = size.unwrap_or(50).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = db.collection::<Link>("links");

    // 只返回正常状态的友链（state=0 或 state 字段不存在）
    let filter = doc! {
        "$or": [
            { "state": LinkState::NORMAL },
            { "state": { "$exists": false } }
        ]
    };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    let total = collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| {
            error!("Failed to count links: {e:?}");
            Status::InternalServerError
        })?;

    let mut cursor = collection
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| {
            error!("Failed to find links: {e:?}");
            Status::InternalServerError
        })?;

    let mut links = Vec::new();
    while let Some(link) = cursor.try_next().await.map_err(|e| {
        error!("Failed to deserialize link: {e:?}");
        Status::InternalServerError
    })? {
        links.push(link);
    }

    // 批量并发检查所有友链的健康状态
    let items = health_service.check_links_batch(links).await;

    let total_page = (total as f64 / size as f64).ceil() as i64;
    let pagination = Pagination {
        total: total as i64,
        current_page: page,
        total_page,
        size,
        has_next_page: page < total_page,
        has_prev_page: page > 1,
    };

    Ok(Json(ApiResponse::success(LinkWithHealthResponse {
        items,
        pagination,
    })))
}

/// Get link by ID
#[utoipa::path(
    get,
    path = "/api/links/{id}",
    params(
        ("id" = String, Path, description = "友链ID")
    ),
    responses(
        (status = 200, description = "成功获取友链详情", body = ApiResponse<Link>),
        (status = 400, description = "无效的ID格式"),
        (status = 404, description = "友链不存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "友链管理"
)]
#[get("/links/<id>")]
pub async fn get_link(db: &State<Database>, id: &str) -> Result<Json<ApiResponse<Link>>, Status> {
    // Validate that the ID looks like a valid ObjectId (24 hex characters)
    if id.len() != 24 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
        log::debug!("Invalid ObjectId format: {id}");
        return Err(Status::NotFound);
    }
    
    let object_id = parse_object_id(id)?;
    let collection = db.collection::<Link>("links");

    let link = db_find_one!(collection, doc! { "_id": object_id })?;

    Ok(Json(ApiResponse::success(link)))
}

/// Apply for a friend link
#[utoipa::path(
    post,
    path = "/api/links/apply",
    request_body = LinkApplyRequest,
    responses(
        (status = 200, description = "友链申请成功", body = ApiResponse<Link>),
        (status = 400, description = "验证码错误或已过期"),
        (status = 409, description = "URL已存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "友链管理"
)]
#[post("/links/apply", data = "<request>")]
pub async fn apply_link(
    db: &State<Database>,
    verification_service: &State<VerificationService>,
    request: Json<LinkApplyRequest>,
) -> Result<Json<ApiResponse<Link>>, Status> {
    // 1. 验证验证码
    match verification_service
        .verify_code(&request.email, &request.code)
        .await
    {
        Ok(()) => {}
        Err(e) => {
            log::warn!("验证码验证失败: {e}");
            return Err(Status::BadRequest);
        }
    }

    let collection = db.collection::<Link>("links");

    // 2. 检查 URL 是否已存在
    let existing = collection
        .find_one(doc! { "url": &request.url })
        .await
        .map_err(|_| Status::InternalServerError)?;

    if existing.is_some() {
        return Err(Status::Conflict);
    }

    // 3. 创建友链
    let new_link = Link {
        id: ObjectId::new(),
        name: request.name.clone(),
        url: request.url.clone(),
        avatar: request.avatar.clone(),
        description: request.description.clone(),
        state: LinkState::PENDING,
        r#type: 0,
        created: bson::DateTime::now(),
        email: Some(request.email.clone()),
        rssurl: request.rssurl.clone(),
        techstack: request.techstack.clone(),
    };

    collection
        .insert_one(&new_link)
        .await
        .map_err(|_| Status::InternalServerError)?;

    Ok(Json(ApiResponse::success(new_link)))
}

/// 友链列表（含健康状态）响应
#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct LinkWithHealthResponse {
    pub items: Vec<LinkWithHealth>,
    pub pagination: Pagination,
}

/// Send verification code to email
#[utoipa::path(
    post,
    path = "/api/links/send-code",
    request_body = SendCodeRequest,
    responses(
        (status = 200, description = "验证码发送成功", body = ApiResponse<String>),
        (status = 429, description = "发送过于频繁，请稍后再试"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "友链管理"
)]
#[post("/links/send-code", data = "<request>")]
pub async fn send_verification_code(
    db: &State<Database>,
    verification_service: &State<VerificationService>,
    request: Json<SendCodeRequest>,
) -> Result<Json<ApiResponse<String>>, Status> {
    // 检查是否已有验证码（防止频繁发送）
    if verification_service.has_code(&request.email).await {
        return Err(Status::TooManyRequests);
    }

    // 生成验证码
    let code = verification_service.send_code(&request.email).await;

    // 获取站点名称
    let site_name = match crate::services::options_service::get_site_config(db).await {
        Ok(config) => {
            if config.seo.title.is_empty() {
                "Neo Space".to_string()
            } else {
                config.seo.title
            }
        }
        Err(_) => "Neo Space".to_string(),
    };

    // 发送邮件
    match send_verification_email(db, &request.email, &code, &site_name).await {
        Ok(()) => {
            log::info!("验证码已发送到: {}", request.email);
            Ok(Json(ApiResponse::success("验证码已发送".to_string())))
        }
        Err(e) => {
            log::error!("发送验证码失败: {e:?}");
            Err(Status::InternalServerError)
        }
    }
}
