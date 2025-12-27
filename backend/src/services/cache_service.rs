#![allow(unused)]
//! Cache service - Moka-based in-memory cache with TTL

use moka::future::Cache;
use std::sync::Arc;
use std::time::Duration;

/// 缓存键类型
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum CacheKey {
    /// 博文详情: post:{id}
    Post(String),
    /// 博文列表: posts:page:{page}:size:{size}
    PostList { page: i64, size: i64 },
    /// 手记详情: note:{id}
    Note(String),
    /// 手记列表: notes:page:{page}:size:{size}
    NoteList { page: i64, size: i64 },
    /// 页面详情: page:{slug}
    Page(String),
    /// 分类列表: categories
    Categories,
}

impl CacheKey {
    /// 转换为字符串键
    pub fn to_string(&self) -> String {
        match self {
            CacheKey::Post(id) => format!("post:{}", id),
            CacheKey::PostList { page, size } => format!("posts:page:{}:size:{}", page, size),
            CacheKey::Note(id) => format!("note:{}", id),
            CacheKey::NoteList { page, size } => format!("notes:page:{}:size:{}", page, size),
            CacheKey::Page(slug) => format!("page:{}", slug),
            CacheKey::Categories => "categories".to_string(),
        }
    }
}

/// 缓存服务
#[derive(Clone)]
pub struct CacheService {
    cache: Arc<Cache<String, Vec<u8>>>,
}

impl CacheService {
    /// 创建新的缓存服务实例
    /// 
    /// # 参数
    /// - `max_capacity`: 最大缓存条目数
    /// - `ttl_seconds`: 缓存过期时间（秒）
    pub fn new(max_capacity: u64, ttl_seconds: u64) -> Self {
        let cache = Cache::builder()
            .max_capacity(max_capacity)
            .time_to_live(Duration::from_secs(ttl_seconds))
            .build();

        log::info!(
            "缓存服务初始化完成 - 容量: {}, TTL: {}秒",
            max_capacity,
            ttl_seconds
        );

        Self {
            cache: Arc::new(cache),
        }
    }

    /// 获取缓存值
    pub async fn get(&self, key: &CacheKey) -> Option<Vec<u8>> {
        let key_str = key.to_string();
        let value = self.cache.get(&key_str).await;
        
        if value.is_some() {
            log::info!("[Cache] ✓ 命中缓存: {}", key_str);
        } else {
            log::debug!("[Cache] 未命中: {}", key_str);
        }
        
        value
    }

    /// 设置缓存值
    pub async fn set(&self, key: &CacheKey, value: Vec<u8>) {
        let key_str = key.to_string();
        let size = value.len();
        self.cache.insert(key_str.clone(), value).await;
        log::info!("[Cache] 写入缓存: {} ({} bytes)", key_str, size);
    }

    /// 删除单个缓存键
    pub async fn invalidate(&self, key: &CacheKey) {
        let key_str = key.to_string();
        log::info!("清除缓存: {}", key_str);
        self.cache.invalidate(&key_str).await;
    }

    /// 批量删除缓存（通过前缀匹配）
    pub async fn invalidate_by_prefix(&self, prefix: &str) {
        log::info!("批量清除缓存 (前缀: {})", prefix);
        
        // 遍历所有键并删除匹配的
        self.cache.run_pending_tasks().await;
        
        // 注意: Moka 不支持直接的前缀删除，需要手动遍历
        // 这里我们使用 invalidate_all 作为简化实现
        // 在生产环境中，建议维护一个键的索引来实现精确的前缀删除
        if prefix == "posts" || prefix == "notes" || prefix == "pages" {
            self.cache.invalidate_all();
            log::warn!("执行全局缓存清除 (前缀: {})", prefix);
        }
    }

    /// 清除所有缓存
    pub async fn clear(&self) {
        log::warn!("清除所有缓存");
        self.cache.invalidate_all();
    }

    /// 获取缓存统计信息
    pub async fn stats(&self) -> CacheStats {
        self.cache.run_pending_tasks().await;
        
        CacheStats {
            entry_count: self.cache.entry_count(),
            weighted_size: self.cache.weighted_size(),
        }
    }
}

/// 缓存统计信息
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub entry_count: u64,
    pub weighted_size: u64,
}
