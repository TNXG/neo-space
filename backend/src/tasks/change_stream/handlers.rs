use mongodb::{bson::Document, change_stream::event::ChangeStreamEvent};

use crate::app::SharedState;
use crate::tasks::isr::trigger_isr_revalidation;
use crate::tasks::meilisearch_sync::{
    sync_note_to_meilisearch, sync_post_to_meilisearch, sync_translation_to_meilisearch,
};

pub(super) async fn handle_translation_change(
    state: &SharedState,
    event: ChangeStreamEvent<Document>,
) -> Result<(), String> {
    let operation = format!("{:?}", event.operation_type);
    tracing::info!("Translation change: op={}", operation);

    if event.full_document.is_some() {
        sync_translation_to_meilisearch(state, event.full_document.as_ref())
            .await
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

pub(super) async fn handle_post_change(
    state: &SharedState,
    event: ChangeStreamEvent<Document>,
) -> Result<(), String> {
    let operation = format!("{:?}", event.operation_type);
    let post_id = event
        .document_key
        .and_then(|key| key.get_object_id("_id").ok())
        .map(|id| id.to_hex());
    let slug = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_str("slug").ok())
        .map(ToString::to_string);
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

    if is_published {
        sync_post_to_meilisearch(state, event.full_document.as_ref())
            .await
            .map_err(|error| error.to_string())?;
    }

    if let Some(id) = post_id {
        let key = format!("post:{id}");
        state.cache.invalidate(&key).await;

        if let Some(slug) = &slug {
            let slug_key = format!("post:slug:{slug}");
            state.cache.invalidate(&slug_key).await;
        }
    }

    trigger_isr_revalidation(state, "posts", slug.as_deref()).await;
    Ok(())
}

pub(super) async fn handle_note_change(
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

    if is_published {
        sync_note_to_meilisearch(state, event.full_document.as_ref())
            .await
            .map_err(|error| error.to_string())?;
    }

    if let Some(id) = note_id {
        let key = format!("note:{id}");
        state.cache.invalidate(&key).await;

        if let Some(nid) = nid {
            let nid_key = format!("note:nid:{nid}");
            state.cache.invalidate(&nid_key).await;
        }
    }

    trigger_isr_revalidation(state, "notes", None).await;
    Ok(())
}

pub(super) async fn handle_link_change(
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

    if let Some(id) = link_id {
        let key = format!("link:{id}");
        state.cache.invalidate(&key).await;
    }
    state.cache.invalidate("links").await;

    if should_refresh {
        trigger_isr_revalidation(state, "links", Some("/friends")).await;
    }

    Ok(())
}
