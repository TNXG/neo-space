use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::models::{Post, PostWithCategory, Category, ApiResponse, PaginatedResponse, PaginatedData, Pagination, AiSummary};
use crate::utils::parse_object_id;
use crate::db_find_one;

/// Minimal post structure for projection queries
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

/// Adjacent post structure
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AdjacentPost {
    /// 文章URL别名
    pub slug: String,
    /// 文章标题
    pub title: String,
    /// 分类URL别名
    #[serde(rename = "categorySlug")]
    pub category_slug: String,
}

/// Adjacent posts response
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AdjacentPosts {
    /// 上一篇文章
    pub prev: Option<AdjacentPost>,
    /// 下一篇文章
    pub next: Option<AdjacentPost>,
}

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
    let filter = doc! { "isPublished": true };

    // Get total count
    let total = posts_collection.count_documents(filter.clone()).await
        .map_err(|e| {
            eprintln!("Error counting posts: {e:?}");
            Status::InternalServerError
        })?;

    // Fetch posts with pagination
    let posts = fetch_published_posts(db, skip, size).await?;

    // Enrich posts with category and AI summary
    let items = enrich_posts_with_data(db, posts).await?;

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
    let object_id = parse_object_id(&id)?;

    let posts_collection = db.collection::<Post>("posts");
    let post = db_find_one!(posts_collection, doc! { "_id": object_id, "isPublished": true })?;

    let enriched = enrich_single_post(db, post, &id).await?;

    Ok(Json(ApiResponse::success(enriched)))
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

    let post = posts_collection.find_one(doc! { "slug": slug, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    let post_id = post.id.to_hex();
    let enriched = enrich_single_post(db, post, &post_id).await?;

    Ok(Json(ApiResponse::success(enriched)))
}

/// Get adjacent posts (previous and next) by slug
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

    // Get current post to find its creation date
    let current_post = posts_collection
        .find_one(doc! { "slug": slug, "isPublished": true })
        .await
        .map_err(|e| {
            eprintln!("Error finding current post: {e:?}");
            Status::InternalServerError
        })?
        .ok_or(Status::NotFound)?;

    // Find previous and next posts
    let prev = find_adjacent_post(db, &current_post, true).await?;
    let next = find_adjacent_post(db, &current_post, false).await?;

    let adjacent = AdjacentPosts { prev, next };

    Ok(Json(ApiResponse::success(adjacent)))
}

/// Fetch published posts with pagination
async fn fetch_published_posts(
    db: &State<Database>,
    skip: i64,
    size: i64,
) -> Result<Vec<Post>, Status> {
    let posts_collection = db.collection::<Post>("posts");

    let filter = doc! { "isPublished": true };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    let mut cursor = posts_collection.find(filter).with_options(find_options).await
        .map_err(|e| {
            eprintln!("Error finding posts: {e:?}");
            Status::InternalServerError
        })?;

    let mut posts = Vec::new();
    while let Some(post) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error iterating posts cursor: {e:?}");
        Status::InternalServerError
    })? {
        posts.push(post);
    }

    Ok(posts)
}

/// Enrich a single post with category and AI summary
async fn enrich_single_post(
    db: &State<Database>,
    post: Post,
    post_id: &str,
) -> Result<PostWithCategory, Status> {
    let category = fetch_category_by_id(db, post.category_id).await?;
    let ai_summary = get_ai_summary(db, post_id, "zh").await;

    let mut post_with_category = PostWithCategory::from(post);
    post_with_category.category = category;
    post_with_category.ai_summary = ai_summary;

    Ok(post_with_category)
}

/// Enrich multiple posts with category and AI summary
async fn enrich_posts_with_data(
    db: &State<Database>,
    posts: Vec<Post>,
) -> Result<Vec<PostWithCategory>, Status> {
    let mut enriched_posts = Vec::new();

    for post in posts {
        let post_id = post.id.to_hex();
        let enriched = enrich_single_post(db, post, &post_id).await?;
        enriched_posts.push(enriched);
    }

    Ok(enriched_posts)
}

/// Fetch category by ID
async fn fetch_category_by_id(
    db: &State<Database>,
    category_id: ObjectId,
) -> Result<Option<Category>, Status> {
    let categories_collection = db.collection::<Category>("categories");

    categories_collection
        .find_one(doc! { "_id": category_id })
        .await
        .map_err(|e| {
            eprintln!("Error finding category: {e:?}");
            Status::InternalServerError
        })
}

/// Find adjacent post (previous or next)
async fn find_adjacent_post(
    db: &State<Database>,
    current_post: &MinimalPost,
    find_previous: bool,
) -> Result<Option<AdjacentPost>, Status> {
    let posts_collection = db.collection::<MinimalPost>("posts");

    let filter = if find_previous {
        doc! {
            "created": { "$lt": current_post.created },
            "isPublished": true
        }
    } else {
        doc! {
            "created": { "$gt": current_post.created },
            "isPublished": true
        }
    };

    let sort_order = if find_previous { -1 } else { 1 };
    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": sort_order })
        .build();

    let adjacent_post = posts_collection.find_one(filter).with_options(find_options).await
        .map_err(|e| {
            eprintln!("Error finding adjacent post: {e:?}");
            Status::InternalServerError
        })?;

    match adjacent_post {
        Some(post) => {
            let category = fetch_category_by_id(db, post.category_id).await?;
            if let Some(cat) = category {
                Ok(Some(AdjacentPost {
                    slug: post.slug,
                    title: post.title,
                    category_slug: cat.slug,
                }))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
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
