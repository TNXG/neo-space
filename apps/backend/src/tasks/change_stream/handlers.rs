use mongodb::{bson::Document, change_stream::event::ChangeStreamEvent};

use crate::app::SharedState;
use crate::tasks::isr::trigger_isr_revalidation;
use crate::tasks::meilisearch_sync::{
    remove_note_from_meilisearch, remove_post_from_meilisearch, sync_note_to_meilisearch,
    sync_post_to_meilisearch, sync_translation_to_meilisearch,
};

pub(super) async fn handle_translation_change(
    state: &SharedState,
    event: ChangeStreamEvent<Document>,
) -> Result<(), String> {
    let operation = format!("{:?}", event.operation_type);
    let document_key = event.document_key.as_ref().map(ToString::to_string);
    let has_full_document = event.full_document.is_some();
    tracing::info!(
        "Translation change: op={}, key={:?}, has_full_document={}, isr=false",
        operation,
        document_key,
        has_full_document
    );

    if event.full_document.is_some() {
        sync_translation_to_meilisearch(state, event.full_document.as_ref())
            .await
            .map_err(|error| error.to_string())?;
    } else {
        tracing::warn!(
            "Translation change skipped Meilisearch sync because full_document is missing: key={:?}",
            document_key
        );
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
        "Post change: op={}, id={:?}, slug={:?}, published={}, has_full_document={}",
        operation,
        post_id,
        slug,
        is_published,
        event.full_document.is_some()
    );

    if is_published {
        sync_post_to_meilisearch(state, event.full_document.as_ref())
            .await
            .map_err(|error| error.to_string())?;
    } else if let Some(id) = post_id.as_deref() {
        // 删除或取消发布时必须移除旧文档，否则搜索索引会残留不可见内容。
        remove_post_from_meilisearch(state, id)
            .await
            .map_err(|error| error.to_string())?;
    } else {
        tracing::info!(
            "Post change skipped Meilisearch cleanup because document id is missing: id={:?}, slug={:?}",
            post_id,
            slug
        );
    }

    if let Some(id) = post_id {
        let key = format!("post:{id}");
        state.cache.invalidate(&key).await;

        if let Some(slug) = &slug {
            let slug_key = format!("post:slug:{slug}");
            state.cache.invalidate(&slug_key).await;
        }
    }

    tracing::info!(
        "Post change triggering ISR revalidation: tag=posts, path={:?}",
        slug
    );
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
        "Note change: op={}, id={:?}, nid={:?}, published={}, has_full_document={}",
        operation,
        note_id,
        nid,
        is_published,
        event.full_document.is_some()
    );

    if is_published {
        sync_note_to_meilisearch(state, event.full_document.as_ref())
            .await
            .map_err(|error| error.to_string())?;
    } else if let Some(id) = note_id.as_deref() {
        // 删除或取消发布时必须移除旧文档，否则搜索索引会残留不可见内容。
        remove_note_from_meilisearch(state, id)
            .await
            .map_err(|error| error.to_string())?;
    } else {
        tracing::info!(
            "Note change skipped Meilisearch cleanup because document id is missing: id={:?}, nid={:?}",
            note_id,
            nid
        );
    }

    if let Some(id) = note_id {
        let key = format!("note:{id}");
        state.cache.invalidate(&key).await;

        if let Some(nid) = nid {
            let nid_key = format!("note:nid:{nid}");
            state.cache.invalidate(&nid_key).await;
        }
    }

    tracing::info!("Note change triggering ISR revalidation: tag=notes, path=None");
    trigger_isr_revalidation(state, "notes", None).await;
    Ok(())
}

pub(super) async fn handle_page_change(
    state: &SharedState,
    event: ChangeStreamEvent<Document>,
) -> Result<(), String> {
    let operation = format!("{:?}", event.operation_type);
    let page_id = event
        .document_key
        .and_then(|key| key.get_object_id("_id").ok())
        .map(|id| id.to_hex());
    let slug = event
        .full_document
        .as_ref()
        .and_then(|doc| doc.get_str("slug").ok())
        .map(ToString::to_string);

    tracing::info!(
        "Page change: op={}, id={:?}, slug={:?}, has_full_document={}",
        operation,
        page_id,
        slug,
        event.full_document.is_some()
    );

    if let Some(id) = page_id {
        let key = format!("page:{id}");
        state.cache.invalidate(&key).await;
    }

    if let Some(slug) = &slug {
        let slug_key = format!("page:{slug}");
        state.cache.invalidate(&slug_key).await;
    }

    state.cache.invalidate("pages").await;
    tracing::info!(
        "Page change triggering ISR revalidation: tag=pages, path={:?}",
        slug
    );
    trigger_isr_revalidation(state, "pages", slug.as_deref()).await;
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
        "Link change: op={}, id={:?}, state={:?}, should_refresh={}, has_full_document={}",
        operation,
        link_id,
        link_state,
        should_refresh,
        event.full_document.is_some()
    );

    if let Some(id) = &link_id {
        let key = format!("link:{id}");
        let health_key = format!("link_health_{id}");
        state.cache.invalidate(&key).await;
        state.link_health_cache.invalidate(&health_key).await;
    }
    state.cache.invalidate("links").await;

    if should_refresh {
        tracing::info!("Link change triggering ISR revalidation: tag=links, path=/friends");
        trigger_isr_revalidation(state, "links", Some("/friends")).await;
    } else {
        tracing::info!(
            "Link change skipped ISR revalidation because link state does not require refresh: id={:?}, state={:?}",
            link_id,
            link_state
        );
    }

    Ok(())
}
