//! MongoDB Change Stream background task
//!
//! Monitors database changes and:
//! - Syncs with Meilisearch
//! - Triggers ISR revalidation for Next.js

use crate::app::SharedState;
use crate::tasks::isr::trigger_isr_revalidation;
use crate::tasks::meilisearch_sync::{sync_note_to_meilisearch, sync_post_to_meilisearch};
use futures::stream::StreamExt;
use mongodb::{Collection, bson::Document, change_stream::event::ChangeStreamEvent};
use std::time::Duration;

/// Start the MongoDB change stream monitoring task
pub fn start_change_stream_task(state: SharedState) {
    tokio::spawn(async move {
        // Retry connection with backoff
        let mut retry_delay = Duration::from_secs(5);
        let max_delay = Duration::from_secs(300);

        loop {
            match monitor_changes(state.clone()).await {
                Ok(_) => {
                    tracing::info!("Change stream ended gracefully, restarting...");
                    retry_delay = Duration::from_secs(5); // Reset delay on success
                }
                Err(e) => {
                    tracing::error!("Change stream error: {}, retrying in {:?}", e, retry_delay);
                    tokio::time::sleep(retry_delay).await;

                    // Exponential backoff with cap
                    retry_delay = std::cmp::min(retry_delay * 2, max_delay);
                }
            }
        }
    });
}

/// Monitor database changes via MongoDB Change Stream
async fn monitor_changes(state: SharedState) -> Result<(), String> {
    // Watch collections: posts, notes, links
    let posts: Collection<Document> = state.db.collection("posts");
    let notes: Collection<Document> = state.db.collection("notes");
    let links: Collection<Document> = state.db.collection("links");

    // Create change streams with full document option
    // Change streams require readConcern "majority"
    let posts_stream = posts
        .watch()
        .full_document(mongodb::options::FullDocumentType::Required)
        .read_concern(mongodb::options::ReadConcern::majority())
        .await
        .map_err(|e| format!("Failed to create posts change stream: {}", e))?;

    let notes_stream = notes
        .watch()
        .full_document(mongodb::options::FullDocumentType::Required)
        .read_concern(mongodb::options::ReadConcern::majority())
        .await
        .map_err(|e| format!("Failed to create notes change stream: {}", e))?;

    let links_stream = links
        .watch()
        .full_document(mongodb::options::FullDocumentType::Required)
        .read_concern(mongodb::options::ReadConcern::majority())
        .await
        .map_err(|e| format!("Failed to create links change stream: {}", e))?;

    tracing::info!("Change stream monitoring started for posts, notes, links");

    // Spawn separate tasks for each change stream
    let state_posts = state.clone();
    tokio::spawn(async move {
        let mut stream = posts_stream;
        while let Some(result) = stream.next().await {
            match result {
                Ok(event) => {
                    if let Err(e) = handle_post_change(&state_posts, event).await {
                        tracing::error!("Failed to handle post change: {}", e);
                    }
                }
                Err(e) => tracing::error!("Post change stream error: {}", e),
            }
        }
    });

    let state_notes = state.clone();
    tokio::spawn(async move {
        let mut stream = notes_stream;
        while let Some(result) = stream.next().await {
            match result {
                Ok(event) => {
                    if let Err(e) = handle_note_change(&state_notes, event).await {
                        tracing::error!("Failed to handle note change: {}", e);
                    }
                }
                Err(e) => tracing::error!("Note change stream error: {}", e),
            }
        }
    });

    let mut stream = links_stream;
    while let Some(result) = stream.next().await {
        match result {
            Ok(event) => {
                if let Err(e) = handle_link_change(&state, event).await {
                    tracing::error!("Failed to handle link change: {}", e);
                }
            }
            Err(e) => tracing::error!("Link change stream error: {}", e),
        }
    }

    Ok(())
}

/// Handle post change events
async fn handle_post_change(
    state: &SharedState,
    event: ChangeStreamEvent<Document>,
) -> Result<(), String> {
    let operation = format!("{:?}", event.operation_type);

    // Extract post ID and data
    let post_id = event
        .document_key
        .and_then(|key| key.get_object_id("_id").ok())
        .map(|id| id.to_hex());

    let slug = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_str("slug").ok())
        .map(|s| s.to_string());

    let is_published = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_bool("isPublished").ok())
        .unwrap_or(false);

    tracing::info!(
        "Post change: op={}, id={:?}, slug={:?}, published={}",
        operation,
        post_id,
        slug,
        is_published
    );

    // Sync to Meilisearch if post is published
    if is_published {
        sync_post_to_meilisearch(state, &event.full_document)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Invalidate cache
    if let Some(id) = post_id {
        let key = format!("post:{}", id);
        state.cache.invalidate(&key).await;

        if let Some(ref s) = slug {
            let slug_key = format!("post:slug:{}", s);
            state.cache.invalidate(&slug_key).await;
        }
    }

    // Trigger ISR revalidation
    trigger_isr_revalidation(state, "posts", slug.as_deref()).await;

    Ok(())
}

/// Handle note change events
async fn handle_note_change(
    state: &SharedState,
    event: ChangeStreamEvent<Document>,
) -> Result<(), String> {
    let operation = format!("{:?}", event.operation_type);

    let note_id = event
        .document_key
        .and_then(|key| key.get_object_id("_id").ok())
        .map(|id| id.to_hex());

    let nid = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_i32("nid").ok());

    let is_published = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_bool("isPublished").ok())
        .unwrap_or(false);

    tracing::info!(
        "Note change: op={}, id={:?}, nid={:?}, published={}",
        operation,
        note_id,
        nid,
        is_published
    );

    // Sync to Meilisearch if note is published
    if is_published {
        sync_note_to_meilisearch(state, &event.full_document)
            .await
            .map_err(|e| e.to_string())?;
    }

    // Invalidate cache
    if let Some(id) = note_id {
        let key = format!("note:{}", id);
        state.cache.invalidate(&key).await;

        if let Some(n) = nid {
            let nid_key = format!("note:nid:{}", n);
            state.cache.invalidate(&nid_key).await;
        }
    }

    // Trigger ISR revalidation
    trigger_isr_revalidation(state, "notes", None).await;

    Ok(())
}

/// Handle link change events
async fn handle_link_change(
    state: &SharedState,
    event: ChangeStreamEvent<Document>,
) -> Result<(), String> {
    let operation = format!("{:?}", event.operation_type);

    let link_id = event
        .document_key
        .and_then(|key| key.get_object_id("_id").ok())
        .map(|id| id.to_hex());

    let link_state = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_i32("state").ok());

    // Check if this change should trigger a refresh (only normal state links)
    let should_refresh = link_state == Some(0)
        || matches!(
            event.operation_type,
            mongodb::change_stream::event::OperationType::Delete
        )
        || matches!(
            event.operation_type,
            mongodb::change_stream::event::OperationType::Drop
        );

    tracing::info!(
        "Link change: op={}, id={:?}, state={:?}, should_refresh={}",
        operation,
        link_id,
        link_state,
        should_refresh
    );

    // Invalidate cache
    if let Some(id) = link_id {
        let key = format!("link:{}", id);
        state.cache.invalidate(&key).await;
    }
    state.cache.invalidate("links").await;

    // Trigger ISR revalidation if needed
    if should_refresh {
        trigger_isr_revalidation(state, "links", Some("/friends")).await;
    }

    Ok(())
}
