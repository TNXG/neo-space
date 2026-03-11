//! ISR (Incremental Static Regeneration) revalidation for Next.js

use crate::app::SharedState;
use std::time::Duration;

/// Trigger ISR revalidation for Next.js
pub(crate) async fn trigger_isr_revalidation(state: &SharedState, tag: &str, path: Option<&str>) {
    let frontend_url = &state.config.frontend_url;

    // Revalidate by tag
    let tag_url = format!("{}/api/revalidate?tag={}", frontend_url, tag);
    if let Err(e) = send_revalidation_request(&state.http_client, &tag_url).await {
        tracing::warn!("Failed to revalidate tag {}: {}", tag, e);
    }

    // Revalidate specific path if provided
    if let Some(p) = path {
        let path_url = format!("{}/api/revalidate?path={}", frontend_url, p);
        if let Err(e) = send_revalidation_request(&state.http_client, &path_url).await {
            tracing::warn!("Failed to revalidate path {}: {}", p, e);
        }
    }
}

/// Send revalidation request to Next.js
pub(crate) async fn send_revalidation_request(
    client: &reqwest::Client,
    url: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let response = client
        .post(url)
        .timeout(Duration::from_secs(10))
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Revalidation failed: {} - {}", status, body).into());
    }

    Ok(())
}
