//! `OpenAPI` documentation configuration

use crate::models::{
    ApiResponse, Category, Link, LinkApplyRequest, Note, NoteCount, NoteImage, Page, PaginatedData,
    Pagination, Post, PostImage, PostWithCategory, Reader, Recently, ResponseStatus, SiteConfig,
    TimeCapsuleRequest, TimeCapsuleResponse, TimeSensitivity, User, UserSocialIds,
};
use crate::routes::nbnhhsh::{GuessRequest, GuessResult};
use crate::routes::notes::{AdjacentNote, AdjacentNotes};
use crate::routes::posts::{AdjacentPost, AdjacentPosts};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "Neo Space API",
        version = "1.0.0",
        description = "Neo Space 博客系统 API 文档",
        contact(
            name = "API Support",
            email = "support@example.com"
        )
    ),
    paths(
        // 友链相关路由
        crate::routes::links::list_links,
        crate::routes::links::get_link,
        crate::routes::links::apply_link,

        // 文章相关路由
        crate::routes::posts::list_posts,
        crate::routes::posts::get_post_by_id,
        crate::routes::posts::get_post_by_slug,
        crate::routes::posts::get_adjacent_posts,

        // 日记相关路由
        crate::routes::notes::list_notes,
        crate::routes::notes::get_note_by_id,
        crate::routes::notes::get_note_by_nid,
        crate::routes::notes::get_adjacent_notes,

        // 分类相关路由
        crate::routes::categories::list_categories,

        // 用户相关路由
        crate::routes::users::get_user_profile,
        crate::routes::users::list_readers,
        crate::routes::users::get_reader_by_id,

        // 页面相关路由
        crate::routes::pages::get_page_by_slug,

        // 动态相关路由
        crate::routes::recentlies::list_recentlies,

        // 站点配置路由
        crate::routes::config::get_site_config,

        // AI服务路由
        crate::routes::ai::analyze_time_capsule,
        crate::routes::ai::get_time_capsule,

        // 工具接口
        crate::routes::nbnhhsh::guess,
    ),
    components(
        schemas(
            // 基础响应模型
            ApiResponse<Link>,
            ApiResponse<PostWithCategory>,
            ApiResponse<Note>,
            ApiResponse<Page>,
            ApiResponse<User>,
            ApiResponse<Reader>,
            ApiResponse<SiteConfig>,
            ApiResponse<TimeCapsuleResponse>,
            ApiResponse<AdjacentPosts>,
            ApiResponse<AdjacentNotes>,
            ApiResponse<Vec<Category>>,
            ApiResponse<Vec<Reader>>,
            PaginatedData<Link>,
            PaginatedData<PostWithCategory>,
            PaginatedData<Note>,
            PaginatedData<Recently>,
            Pagination,
            ResponseStatus,

            // 业务模型
            Link,
            LinkApplyRequest,
            Post,
            PostWithCategory,
            PostImage,
            Category,
            Note,
            NoteImage,
            NoteCount,
            Page,
            Recently,
            User,
            UserSocialIds,
            Reader,
            SiteConfig,

            // AI相关模型
            TimeCapsuleRequest,
            TimeCapsuleResponse,
            TimeSensitivity,

            // 相邻内容模型
            AdjacentPosts,
            AdjacentPost,
            AdjacentNotes,
            AdjacentNote,

            // 工具接口模型
            GuessRequest,
            GuessResult,
        )
    ),
    tags(
        (name = "友链管理", description = "友链相关接口"),
        (name = "文章管理", description = "文章相关接口"),
        (name = "日记管理", description = "日记相关接口"),
        (name = "分类管理", description = "分类相关接口"),
        (name = "用户管理", description = "用户相关接口"),
        (name = "页面管理", description = "页面相关接口"),
        (name = "动态管理", description = "动态相关接口"),
        (name = "站点配置", description = "站点配置接口"),
        (name = "AI服务", description = "AI相关服务接口"),
        (name = "工具接口", description = "实用工具接口"),
    )
)]
pub struct ApiDoc;
