use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use log::error;

use crate::models::{Link, LinkApplyRequest, LinkState, ApiResponse, Pagination};
use crate::services::LinkHealthService;
use crate::services::link_health_service::LinkWithHealth;

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

    let total = collection.count_documents(filter.clone()).await
        .map_err(|e| {
            error!("Failed to count links: {:?}", e);
            Status::InternalServerError
        })?;

    let mut cursor = collection.find(filter).with_options(find_options).await
        .map_err(|e| {
            error!("Failed to find links: {:?}", e);
            Status::InternalServerError
        })?;

    let mut links = Vec::new();
    while let Some(link) = cursor.try_next().await.map_err(|e| {
        error!("Failed to deserialize link: {:?}", e);
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
pub async fn get_link(
    db: &State<Database>,
    id: &str,
) -> Result<Json<ApiResponse<Link>>, Status> {
    let object_id = ObjectId::parse_str(id).map_err(|_| Status::BadRequest)?;
    let collection = db.collection::<Link>("links");

    let link = collection
        .find_one(doc! { "_id": object_id })
        .await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    Ok(Json(ApiResponse::success(link)))
}

/// Apply for a friend link
#[utoipa::path(
    post,
    path = "/api/links/apply",
    request_body = LinkApplyRequest,
    responses(
        (status = 200, description = "友链申请成功", body = ApiResponse<Link>),
        (status = 409, description = "URL已存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "友链管理"
)]
#[post("/links/apply", data = "<request>")]
pub async fn apply_link(
    db: &State<Database>,
    request: Json<LinkApplyRequest>,
) -> Result<Json<ApiResponse<Link>>, Status> {
    let collection = db.collection::<Link>("links");

    // 检查 URL 是否已存在
    let existing = collection
        .find_one(doc! { "url": &request.url })
        .await
        .map_err(|_| Status::InternalServerError)?;

    if existing.is_some() {
        return Err(Status::Conflict);
    }

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
