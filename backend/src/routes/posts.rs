use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use std::str::FromStr;

use crate::models::{Post, PostWithCategory, Category, ApiResponse, PaginatedResponse, PaginatedData, Pagination, AiSummary};

/// List published posts with pagination
#[utoipa::path(
    get,
    path = "/api/posts",
    params(
        ("page" = Option<i64>, Query, description = "页码，默认为1"),
        ("size" = Option<i64>, Query, description = "每页大小，默认为10，最大100")
    ),
    responses(
        (status = 200, description = "成功获取文章列表", body = PaginatedResponse<PostWithCategory>),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "文章管理"
)]
#[get("/posts?<page>&<size>")]
pub async fn list_posts(
    db: &State<Database>,
    page: Option<i64>,
    size: Option<i64>,
) -> Result<Json<PaginatedResponse<PostWithCategory>>, Status> {
    let page = page.unwrap_or(1).max(1);
    let size = size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let posts_collection = db.collection::<Post>("posts");
    let categories_collection = db.collection::<Category>("categories");
    
    // Query only published posts, sorted by creation date (newest first)
    let filter = doc! { "isPublished": true };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    // Get total count
    let total = posts_collection.count_documents(filter.clone()).await
        .map_err(|e| {
            eprintln!("Error counting posts: {e:?}");
            Status::InternalServerError
        })?;

    // Fetch posts
    let mut cursor = posts_collection.find(filter).with_options(find_options).await
        .map_err(|e| {
            eprintln!("Error finding posts: {e:?}");
            Status::InternalServerError
        })?;

    let mut items = Vec::new();
    while let Some(post) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error iterating posts cursor: {e:?}");
        Status::InternalServerError
    })? {
        // Fetch category information
        let category = categories_collection
            .find_one(doc! { "_id": post.category_id })
            .await
            .map_err(|e| {
                eprintln!("Error finding category: {e:?}");
                Status::InternalServerError
            })?;

        let post_id = post.id.to_hex();
        let mut post_with_category = PostWithCategory::from(post);
        post_with_category.category = category;
        
        // Fetch AI summary (default to Chinese)
        post_with_category.ai_summary = get_ai_summary(db, &post_id, "zh").await;
        
        items.push(post_with_category);
    }

    let total_page = (total as f64 / size as f64).ceil() as i64;
    let pagination = Pagination {
        total: total as i64,
        current_page: page,
        total_page,
        size,
        has_next_page: page < total_page,
        has_prev_page: page > 1,
    };

    Ok(Json(ApiResponse::success(PaginatedData { items, pagination })))
}

/// Helper function to get the latest AI summary for a given ref ID
async fn get_ai_summary(db: &Database, ref_id: &str, lang: &str) -> Option<String> {
    let ai_summaries_collection = db.collection::<AiSummary>("ai_summaries");
    
    // Find the latest AI summary for this ref ID and language
    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    
    ai_summaries_collection
        .find_one(doc! { "refId": ref_id, "lang": lang })
        .with_options(find_options)
        .await
        .ok()
        .flatten()
        .map(|s| s.summary)
}

/// Get post by ID
#[utoipa::path(
    get,
    path = "/api/posts/{id}",
    params(
        ("id" = String, Path, description = "文章ID")
    ),
    responses(
        (status = 200, description = "成功获取文章详情", body = ApiResponse<PostWithCategory>),
        (status = 400, description = "无效的ID格式"),
        (status = 404, description = "文章不存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "文章管理"
)]
#[get("/posts/<id>")]
pub async fn get_post_by_id(
    db: &State<Database>,
    id: String,
) -> Result<Json<ApiResponse<PostWithCategory>>, Status> {
    let object_id = ObjectId::from_str(&id).map_err(|_| Status::BadRequest)?;
    
    let posts_collection = db.collection::<Post>("posts");
    let categories_collection = db.collection::<Category>("categories");
    
    let post = posts_collection.find_one(doc! { "_id": object_id, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    // Fetch category information
    let category = categories_collection
        .find_one(doc! { "_id": post.category_id })
        .await
        .map_err(|_| Status::InternalServerError)?;

    let mut post_with_category = PostWithCategory::from(post);
    post_with_category.category = category;
    
    // Fetch AI summary (default to Chinese)
    post_with_category.ai_summary = get_ai_summary(db, &id, "zh").await;

    Ok(Json(ApiResponse::success(post_with_category)))
}

/// Get post by slug
#[utoipa::path(
    get,
    path = "/api/posts/slug/{slug}",
    params(
        ("slug" = String, Path, description = "文章URL别名")
    ),
    responses(
        (status = 200, description = "成功获取文章详情", body = ApiResponse<PostWithCategory>),
        (status = 404, description = "文章不存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "文章管理"
)]
#[get("/posts/slug/<slug>")]
pub async fn get_post_by_slug(
    db: &State<Database>,
    slug: &str,
) -> Result<Json<ApiResponse<PostWithCategory>>, Status> {
    let posts_collection = db.collection::<Post>("posts");
    let categories_collection = db.collection::<Category>("categories");
    
    let post = posts_collection.find_one(doc! { "slug": slug, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    // Get post ID as string for AI summary lookup
    let post_id = post.id.to_hex();

    // Fetch category information
    let category = categories_collection
        .find_one(doc! { "_id": post.category_id })
        .await
        .map_err(|_| Status::InternalServerError)?;

    let mut post_with_category = PostWithCategory::from(post);
    post_with_category.category = category;
    
    // Fetch AI summary (default to Chinese)
    post_with_category.ai_summary = get_ai_summary(db, &post_id, "zh").await;

    Ok(Json(ApiResponse::success(post_with_category)))
}

/// Get adjacent posts (previous and next) by slug
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AdjacentPosts {
    /// 上一篇文章
    pub prev: Option<AdjacentPost>,
    /// 下一篇文章
    pub next: Option<AdjacentPost>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AdjacentPost {
    /// 文章URL别名
    pub slug: String,
    /// 文章标题
    pub title: String,
    /// 分类URL别名
    #[serde(rename = "categorySlug")]
    pub category_slug: String,
}/// Minimal post structure for projection queries
#[derive(Debug, Serialize, Deserialize)]
struct MinimalPost {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub slug: String,
    pub title: String,
    #[serde(rename = "categoryId")]
    pub category_id: ObjectId,
    pub created: bson::DateTime,
}

#[utoipa::path(
    get,
    path = "/api/posts/slug/{slug}/adjacent",
    params(
        ("slug" = String, Path, description = "文章URL别名")
    ),
    responses(
        (status = 200, description = "成功获取相邻文章", body = ApiResponse<AdjacentPosts>),
        (status = 404, description = "文章不存在"),
        (status = 500, description = "服务器内部错误")
    ),
    tag = "文章管理"
)]
#[get("/posts/slug/<slug>/adjacent")]
pub async fn get_adjacent_posts(
    db: &State<Database>,
    slug: &str,
) -> Result<Json<ApiResponse<AdjacentPosts>>, Status> {
    let posts_collection = db.collection::<MinimalPost>("posts");
    let categories_collection = db.collection::<Category>("categories");
    
    // First, get the current post to find its creation date
    let current_post = posts_collection
        .find_one(doc! { "slug": slug, "isPublished": true })
        .await
        .map_err(|e| {
            eprintln!("Error finding current post: {e:?}");
            Status::InternalServerError
        })?
        .ok_or(Status::NotFound)?;
    
    // Find previous post (older, smaller created date)
    let prev_filter = doc! { 
        "created": { "$lt": current_post.created },
        "isPublished": true 
    };
    let prev_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    
    let prev_post = posts_collection.find_one(prev_filter)
        .with_options(prev_options)
        .await
        .map_err(|e| {
            eprintln!("Error finding previous post: {e:?}");
            Status::InternalServerError
        })?;
    
    // Find next post (newer, larger created date)
    let next_filter = doc! { 
        "created": { "$gt": current_post.created },
        "isPublished": true 
    };
    let next_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": 1 })
        .build();
    
    let next_post = posts_collection.find_one(next_filter)
        .with_options(next_options)
        .await
        .map_err(|e| {
            eprintln!("Error finding next post: {e:?}");
            Status::InternalServerError
        })?;
    
    // Build adjacent posts with category slugs
    let prev = if let Some(post) = prev_post {
        let category = categories_collection
            .find_one(doc! { "_id": post.category_id })
            .await
            .ok()
            .flatten();
        
        if let Some(cat) = category {
            Some(AdjacentPost {
                slug: post.slug,
                title: post.title,
                category_slug: cat.slug,
            })
        } else {
            None
        }
    } else {
        None
    };
    
    let next = if let Some(post) = next_post {
        let category = categories_collection
            .find_one(doc! { "_id": post.category_id })
            .await
            .ok()
            .flatten();
        
        if let Some(cat) = category {
            Some(AdjacentPost {
                slug: post.slug,
                title: post.title,
                category_slug: cat.slug,
            })
        } else {
            None
        }
    } else {
        None
    };
    
    let adjacent = AdjacentPosts { prev, next };
    
    Ok(Json(ApiResponse::success(adjacent)))
}
