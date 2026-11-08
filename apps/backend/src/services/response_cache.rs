//! Process-local public API responses with bounded weight and generation-safe invalidation.
use std::{
    sync::{
        Arc,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};

use axum::{body::Bytes, http::HeaderMap};
use moka::future::Cache;

/// Complete URL and invalidation generation; language and filters never share an entry.
pub type ResponseCacheKey = (u64, String);

/// Uncompressed response data; CORS and compression are applied separately for every request.
#[derive(Clone)]
pub struct CachedResponse {
    pub headers: HeaderMap,
    pub body: Bytes,
}

/// Clones share both the Moka store and the invalidation generation.
#[derive(Clone)]
pub struct ResponseCache {
    pub entries: Cache<ResponseCacheKey, CachedResponse>,
    generation: Arc<AtomicU64>,
}

impl Default for ResponseCache {
    /// Expire after five minutes total or one minute without a read.
    fn default() -> Self {
        Self::new(Duration::from_secs(300), Duration::from_secs(60))
    }
}

impl ResponseCache {
    /// Construct a cache with explicit expiry, weighted to approximately 64 MiB including metadata.
    #[must_use]
    pub fn new(ttl: Duration, idle: Duration) -> Self {
        let entries = Cache::builder()
            .max_capacity(64 * 1024 * 1024)
            .weigher(|key: &ResponseCacheKey, response: &CachedResponse| {
                let headers = response
                    .headers
                    .iter()
                    .map(|(name, value)| name.as_str().len() + value.len())
                    .sum::<usize>();
                u32::try_from(
                    key.1
                        .len()
                        .saturating_add(response.body.len())
                        .saturating_add(headers)
                        .saturating_add(256),
                )
                .unwrap_or(u32::MAX)
            })
            .time_to_live(ttl)
            .time_to_idle(idle)
            .build();
        Self {
            entries,
            generation: Arc::new(AtomicU64::new(0)),
        }
    }

    /// Capture the current generation before starting any database work.
    #[must_use]
    pub fn key(&self, uri: &str) -> ResponseCacheKey {
        (self.generation.load(Ordering::Acquire), uri.to_owned())
    }

    /// Make old entries unreachable, including reads still finishing after a content write.
    pub fn invalidate_all(&self) {
        self.generation.fetch_add(1, Ordering::AcqRel);
        self.entries.invalidate_all();
    }
}
