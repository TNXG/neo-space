//! 友链订阅源抓取：只保留最新一篇与条目总数，避免把整份 feed 留在内存。

use std::time::Duration;

use super::is_ssrf_url;
use crate::models::{LinkFeedEntry, LinkFeedSummary};

/// 单个订阅源最大下载体积；超过即判定失败，防止恶意或异常大的 feed 撑爆内存。
const MAX_FEED_BYTES: usize = 2 * 1024 * 1024;
const MAX_TITLE_CHARS: usize = 120;
const MAX_SUMMARY_CHARS: usize = 160;

/// 抓取并解析订阅源；任何失败都只体现在 `error_message` 中，不向上传播。
pub async fn fetch_feed_summary(
    link_id: &str,
    feed_url: &str,
    http_client: &reqwest::Client,
    timeout_secs: u64,
) -> LinkFeedSummary {
    let result = fetch_and_parse(feed_url, http_client, timeout_secs).await;
    let checked_at = chrono::Utc::now().to_rfc3339();
    match result {
        Ok((latest, total)) => LinkFeedSummary {
            link_id: link_id.to_string(),
            feed_url: feed_url.to_string(),
            latest,
            total,
            checked_at,
            error_message: None,
        },
        Err(error) => {
            tracing::warn!("[LinkFeed] {} - 失败: {}", feed_url, error);
            LinkFeedSummary {
                link_id: link_id.to_string(),
                feed_url: feed_url.to_string(),
                latest: None,
                total: 0,
                checked_at,
                error_message: Some(error),
            }
        }
    }
}

async fn fetch_and_parse(
    feed_url: &str,
    http_client: &reqwest::Client,
    timeout_secs: u64,
) -> Result<(Option<LinkFeedEntry>, usize), String> {
    if is_ssrf_url(feed_url) {
        return Err("Blocked: private/internal URL".to_string());
    }

    let mut response = http_client
        .get(feed_url)
        .header(
            "Accept",
            "application/rss+xml, application/atom+xml, application/feed+json, application/xml;q=0.9, */*;q=0.8",
        )
        .timeout(Duration::from_secs(timeout_secs.clamp(1, 120)))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "Request timeout".to_string()
            } else {
                "Connection failed".to_string()
            }
        })?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status().as_u16()));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_FEED_BYTES as u64)
    {
        return Err("Feed too large".to_string());
    }

    let mut body = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Read failed".to_string())?
    {
        if body.len() + chunk.len() > MAX_FEED_BYTES {
            return Err("Feed too large".to_string());
        }
        body.extend_from_slice(&chunk);
    }

    let feed = feed_rs::parser::parse(body.as_slice()).map_err(|_| "Invalid feed".to_string())?;
    let total = feed.entries.len();
    let latest = feed
        .entries
        .into_iter()
        .max_by_key(|entry| entry.published.or(entry.updated))
        .map(to_entry);
    Ok((latest, total))
}

fn to_entry(entry: feed_rs::model::Entry) -> LinkFeedEntry {
    let url = entry
        .links
        .iter()
        .find(|link| link.rel.as_deref().is_none_or(|rel| rel == "alternate"))
        .or_else(|| entry.links.first())
        .map(|link| link.href.clone())
        .unwrap_or_default();
    let title = entry
        .title
        .map(|text| truncate(&text.content, MAX_TITLE_CHARS))
        .unwrap_or_default();
    let summary = entry
        .summary
        .map(|text| text.content)
        .or_else(|| entry.content.and_then(|content| content.body))
        .map(|raw| truncate(&strip_html(&raw), MAX_SUMMARY_CHARS))
        .filter(|text| !text.is_empty());
    LinkFeedEntry {
        title,
        url: if is_http_url(&url) { url } else { String::new() },
        summary,
        published: entry.published.or(entry.updated).map(|date| date.to_rfc3339()),
    }
}

/// 只接受 http(s) 链接，避免 `javascript:` 等协议流入前端 href。
fn is_http_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.starts_with("https://") || lower.starts_with("http://")
}

/// 摘要只展示纯文本：去标签、解实体、合并空白。
fn strip_html(raw: &str) -> String {
    let mut text = String::with_capacity(raw.len().min(4096));
    let mut in_tag = false;
    for character in raw.chars() {
        match character {
            '<' => in_tag = true,
            '>' if in_tag => {
                in_tag = false;
                text.push(' ');
            }
            _ if !in_tag => text.push(character),
            _ => {}
        }
        if text.len() > 4096 {
            break;
        }
    }
    let decoded = html_escape::decode_html_entities(&text);
    decoded.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }
    let mut result: String = trimmed.chars().take(max_chars).collect();
    result.push('…');
    result
}

#[cfg(test)]
mod tests {
    use super::{strip_html, truncate};

    #[test]
    fn strips_tags_and_entities() {
        assert_eq!(strip_html("<p>Hello&nbsp;<b>world</b></p>"), "Hello world");
    }

    #[test]
    fn truncates_by_chars() {
        assert_eq!(truncate("你好世界", 2), "你好…");
        assert_eq!(truncate(" ok ", 5), "ok");
    }
}
