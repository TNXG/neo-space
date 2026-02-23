//! 服务初始化
//!
//! 负责所有服务的初始化

use crate::config::OAuthConfig;
use crate::infrastructure::search::service::{NoteDocument, PostDocument};
use crate::infrastructure::search::SearchService;
use crate::integrations::{IpService, LinkHealthService};
use crate::models::{Category, Note, Post};
use crate::services::{
    auth::JWTVerifier, CacheService, ChangeStreamService, RevalidationService, VerificationService,
};
use futures::stream::TryStreamExt;
use mongodb::bson::doc;
use mongodb::Database;

/// 所有应用服务的集合
pub struct AppServices {
    pub cache: CacheService,
    #[allow(dead_code)]
    pub revalidation: Option<std::sync::Arc<RevalidationService>>,
    pub ip: IpService,
    pub link_health: LinkHealthService,
    pub verification: VerificationService,
    pub jwt_verifier: JWTVerifier,
    pub search: Option<SearchService>,
}

/// 初始化所有应用服务
///
/// # 参数
/// * `database` - 数据库连接
/// * `oauth_config` - OAuth 配置（包含 JWT secret）
///
/// # 返回
/// 返回初始化完成的服务集合
pub async fn init_services(database: Database, oauth_config: &OAuthConfig) -> AppServices {
    log::info!("开始初始化应用服务...");

    // Initialize cache service
    let cache_max_capacity = std::env::var("CACHE_MAX_CAPACITY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10000);
    let cache_ttl_seconds = std::env::var("CACHE_TTL_SECONDS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3600);

    let cache_service = CacheService::new(cache_max_capacity, cache_ttl_seconds);
    log::info!("缓存服务初始化成功");

    // Initialize revalidation service (optional - only if configured)
    let nextjs_url =
        std::env::var("NEXTJS_URL").unwrap_or_else(|_| "http://localhost:3000".to_string());
    let revalidation_secret = std::env::var("REVALIDATION_SECRET").ok();
    let revalidation_salt =
        std::env::var("REVALIDATION_SALT").unwrap_or_else(|_| "default-salt".to_string());

    let revalidation_service_opt = if let Some(secret) = revalidation_secret.clone() {
        let service = std::sync::Arc::new(RevalidationService::new(
            nextjs_url,
            secret,
            revalidation_salt,
        ));
        log::info!("Revalidation 服务初始化成功");
        Some(service)
    } else {
        log::warn!("REVALIDATION_SECRET 未配置，Revalidation 服务已禁用");
        None
    };

    // Only start Change Stream if revalidation is configured and not in test mode
    let disable_change_stream = std::env::var("DISABLE_CHANGE_STREAM")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);

    // Initialize search service (optional) - before Change Stream so it can be passed in
    let search_service = if let Ok(meilisearch_url) = std::env::var("MEILISEARCH_URL") {
        let api_key = std::env::var("MEILISEARCH_API_KEY").ok();
        let service = SearchService::new(meilisearch_url, api_key);

        // 异步初始化索引并同步数据
        let service_clone = service.clone();
        let db_clone = database.clone();
        tokio::spawn(async move {
            if let Err(e) = service_clone.init_indexes().await {
                log::warn!("Meilisearch 索引初始化失败: {e}");
                return;
            }

            // 从 MongoDB 同步数据到 Meilisearch
            sync_posts_to_search(&db_clone, &service_clone).await;
            sync_notes_to_search(&db_clone, &service_clone).await;
        });

        log::info!("Meilisearch 搜索服务初始化成功");
        Some(service)
    } else {
        log::warn!("MEILISEARCH_URL 未配置，搜索服务已禁用");
        None
    };

    if disable_change_stream {
        log::info!("Change Stream 监听服务已禁用（DISABLE_CHANGE_STREAM=true）");
    } else if let Some(ref revalidation_service) = revalidation_service_opt {
        // Initialize and start Change Stream service in background
        let change_stream_service = ChangeStreamService::new(
            database.clone(),
            cache_service.clone(),
            revalidation_service.as_ref().clone(),
            search_service.clone(),
        );

        // Spawn Change Stream listener in background task
        tokio::spawn(async move {
            change_stream_service.start_watching().await;
        });
        log::info!("Change Stream 监听服务已启动（后台任务）");
    } else {
        log::warn!("Change Stream 监听服务已禁用");
        log::warn!("如需启用 ISR 缓存自动刷新，请在 .env 中配置 REVALIDATION_SECRET");
    }

    // Initialize IP service
    let ip_service = IpService::new();
    log::info!("IP 地理位置服务初始化成功（使用 Bilibili API）");

    // Initialize link health service
    let link_health_stale_hours = std::env::var("LINK_HEALTH_STALE_HOURS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(6); // 默认 6 小时
    let link_health_timeout = std::env::var("LINK_HEALTH_TIMEOUT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(10); // 默认 10 秒
    let link_health_check_interval = std::env::var("LINK_HEALTH_CHECK_INTERVAL")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(6); // 默认 6 小时检查一次

    let mut link_health_service =
        LinkHealthService::new(link_health_stale_hours, link_health_timeout);

    // 注入 Revalidation 服务（如果已配置）
    if let Some(ref revalidation_service) = revalidation_service_opt {
        link_health_service =
            link_health_service.with_revalidation_service(revalidation_service.clone());
        log::info!("友链健康检查服务已关联 Revalidation 服务");
    }

    log::info!("友链健康检查服务初始化成功");

    // Initialize verification service
    let verification_service = VerificationService::new();
    log::info!("验证码服务初始化成功");

    // Initialize JWT verifier
    let jwt_verifier = JWTVerifier::new(oauth_config.jwt_secret.clone());
    log::info!("JWT 验证服务初始化成功");

    // 启动时异步检查所有友链（后台任务）
    {
        let service = link_health_service.clone();
        let db = database.clone();
        tokio::spawn(async move {
            log::info!("启动友链健康检查后台任务...");
            let result = service.check_all_links(&db).await;
            log::info!(
                "友链健康检查完成 - 总数: {}, 存活: {}, 失败: {}, 耗时: {}ms",
                result.total,
                result.alive_count,
                result.failed_count,
                result.duration_ms
            );
        });
    }

    // 启动定期健康检查任务
    {
        let service = link_health_service.clone();
        let db = database.clone();
        service.start_periodic_check(db, link_health_check_interval);
        log::info!("友链定期健康检查任务已启动（间隔: {link_health_check_interval}小时）");
    }

    AppServices {
        cache: cache_service,
        revalidation: revalidation_service_opt,
        ip: ip_service,
        link_health: link_health_service,
        verification: verification_service,
        jwt_verifier,
        search: search_service,
    }
}

/// 同步文章数据到 Meilisearch
async fn sync_posts_to_search(db: &Database, search: &SearchService) {
    let posts_col = db.collection::<Post>("posts");
    let categories_col = db.collection::<Category>("categories");

    let filter = doc! { "isPublished": true };
    let mut cursor = match posts_col.find(filter).await {
        Ok(c) => c,
        Err(e) => {
            log::error!("同步文章数据失败 - 无法查询 MongoDB: {e}");
            return;
        }
    };

    let mut docs = Vec::new();
    while let Ok(Some(post)) = cursor.try_next().await {
        // 查找分类信息
        let category = categories_col
            .find_one(doc! { "_id": post.category_id })
            .await
            .ok()
            .flatten();

        docs.push(PostDocument {
            id: post.id.to_hex(),
            title: post.title,
            text: post.text,
            slug: post.slug,
            category: category.as_ref().map(|c| c.slug.clone()),
            category_name: category.map(|c| c.name),
            tags: post.tags,
            created: post.created.timestamp_millis() / 1000,
        });
    }

    let count = docs.len();
    if let Err(e) = search.index_posts(docs).await {
        log::error!("同步文章到 Meilisearch 失败: {e}");
    } else {
        log::info!("已同步 {count} 篇文章到 Meilisearch");
    }
}

/// 同步笔记数据到 Meilisearch
async fn sync_notes_to_search(db: &Database, search: &SearchService) {
    let notes_col = db.collection::<Note>("notes");

    let filter = doc! {};
    let mut cursor = match notes_col.find(filter).await {
        Ok(c) => c,
        Err(e) => {
            log::error!("同步笔记数据失败 - 无法查询 MongoDB: {e}");
            return;
        }
    };

    let mut docs = Vec::new();
    while let Ok(Some(note)) = cursor.try_next().await {
        docs.push(NoteDocument {
            id: note.id.to_hex(),
            title: note.title,
            text: note.text,
            nid: note.nid,
            created: note.created.timestamp_millis() / 1000,
        });
    }

    let count = docs.len();
    if let Err(e) = search.index_notes(docs).await {
        log::error!("同步笔记到 Meilisearch 失败: {e}");
    } else {
        log::info!("已同步 {count} 篇笔记到 Meilisearch");
    }
}
