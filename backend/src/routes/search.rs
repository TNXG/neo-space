//! 搜索 API 路由
//!
//! 提供基于 Meilisearch 的全文搜索能力

use crate::infrastructure::search::SearchService;
use crate::models::ApiResponse;
use rocket::get;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket::State;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// 分类信息
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct CategoryInfo {
    /// 分类显示名称
    pub name: String,
    /// 分类 slug（URL 别名）
    pub slug: String,
}

/// 文章搜索结果
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct SearchPostResult {
    /// 文章 ID
    pub id: String,
    /// 文章标题
    pub title: String,
    /// 文章 URL 别名
    pub slug: String,
    /// 分类信息
    pub category: Option<CategoryInfo>,
    /// 标签列表
    pub tags: Vec<String>,
    /// 创建时间（Unix 时间戳）
    pub created: i64,
    /// 高亮后的标题 (包含 <mark> 标签)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlighted_title: Option<String>,
    /// 正文摘要（包含 <mark> 高亮标签，已裁剪到关键字附近）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_highlight: Option<String>,
    /// 相关度评分 0.0 ~ 1.0
    pub score: f64,
}

/// 笔记搜索结果
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct SearchNoteResult {
    /// 笔记 ID
    pub id: String,
    /// 笔记标题
    pub title: String,
    /// 笔记数字 ID
    pub nid: i32,
    /// 创建时间（Unix 时间戳）
    pub created: i64,
    /// 高亮后的标题
    #[serde(skip_serializing_if = "Option::is_none")]
    pub highlighted_title: Option<String>,
    /// 正文摘要（包含 <mark> 高亮标签）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content_highlight: Option<String>,
    /// 相关度评分 0.0 ~ 1.0
    pub score: f64,
}

/// 搜索结果
#[derive(Debug, Serialize, Deserialize, Clone, ToSchema)]
pub struct SearchResults {
    /// 文章搜索结果
    pub posts: Vec<SearchPostResult>,
    /// 笔记搜索结果
    pub notes: Vec<SearchNoteResult>,
}

/// 搜索文章和笔记
#[utoipa::path(
    get,
    path = "/api/search",
    params(
        ("q" = String, Query, description = "搜索关键词"),
        ("type" = Option<String>, Query, description = "搜索类型：post/note，不传则搜索全部"),
        ("limit" = Option<usize>, Query, description = "每种类型的最大结果数，默认 10"),
        ("offset" = Option<usize>, Query, description = "偏移量，默认 0")
    ),
    responses(
        (status = 200, description = "搜索成功", body = ApiResponse<SearchResults>),
        (status = 400, description = "缺少搜索关键词"),
        (status = 503, description = "搜索服务不可用")
    ),
    tag = "搜索"
)]
#[get("/search?<q>&<type_>&<limit>&<offset>")]
pub async fn search(
    search_service: &State<Option<SearchService>>,
    q: Option<String>,
    type_: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Json<ApiResponse<SearchResults>>, Status> {
    // 检查搜索服务是否可用
    let service = search_service.as_ref().ok_or(Status::ServiceUnavailable)?;

    // 验证搜索关键词
    let query = q
        .filter(|s| !s.trim().is_empty())
        .ok_or(Status::BadRequest)?;

    let limit = limit.unwrap_or(10).min(50);
    let offset = offset.unwrap_or(0);
    let search_type = type_.as_deref();

    let mut results = SearchResults {
        posts: Vec::new(),
        notes: Vec::new(),
    };

    // 搜索文章
    if search_type.is_none() || search_type == Some("post") {
        match service.search_posts(&query, limit, offset).await {
            Ok(hits) => {
                results.posts = hits
                    .into_iter()
                    .map(|hit| SearchPostResult {
                        id: hit.doc.id,
                        title: hit.doc.title,
                        slug: hit.doc.slug,
                        category: match (hit.doc.category, hit.doc.category_name) {
                            (Some(slug), Some(name)) => Some(CategoryInfo { name, slug }),
                            _ => None,
                        },
                        tags: hit.doc.tags,
                        created: hit.doc.created,
                        highlighted_title: hit.formatted.get("title").cloned(),
                        content_highlight: hit.formatted.get("text").cloned(),
                        score: hit.score,
                    })
                    .collect();
            }
            Err(e) => {
                log::error!("搜索文章失败: {e}");
            }
        }
    }

    // 搜索笔记
    if search_type.is_none() || search_type == Some("note") {
        match service.search_notes(&query, limit, offset).await {
            Ok(hits) => {
                results.notes = hits
                    .into_iter()
                    .map(|hit| SearchNoteResult {
                        id: hit.doc.id,
                        title: hit.doc.title,
                        nid: hit.doc.nid,
                        created: hit.doc.created,
                        highlighted_title: hit.formatted.get("title").cloned(),
                        content_highlight: hit.formatted.get("text").cloned(),
                        score: hit.score,
                    })
                    .collect();
            }
            Err(e) => {
                log::error!("搜索笔记失败: {e}");
            }
        }
    }

    Ok(Json(ApiResponse::success(results)))
}
