//! MongoDB change stream background task

mod handlers;

use std::time::Duration;

use futures::stream::StreamExt;
use mongodb::{Collection, bson::Document};

use crate::app::SharedState;

use self::handlers::{
    handle_link_change, handle_note_change, handle_page_change, handle_post_change,
    handle_translation_change,
};

/// Start the `MongoDB` change stream monitoring task.
pub fn start_change_stream_task(state: SharedState) {
    tokio::spawn(async move {
        let mut retry_delay = Duration::from_secs(5);
        let max_delay = Duration::from_secs(300);

        loop {
            match monitor_changes(state.clone()).await {
                Ok(()) => {
                    tracing::info!("Change stream ended gracefully, restarting...");
                    retry_delay = Duration::from_secs(5);
                }
                Err(error) => {
                    tracing::error!(
                        "Change stream error: {}, retrying in {:?}",
                        error,
                        retry_delay
                    );
                    tokio::time::sleep(retry_delay).await;
                    retry_delay = std::cmp::min(retry_delay * 2, max_delay);
                }
            }
        }
    });
}

async fn monitor_changes(state: SharedState) -> Result<(), String> {
    tracing::info!("正在初始化 MongoDB Change Stream...");

    let posts: Collection<Document> = state.db.collection("posts");
    let notes: Collection<Document> = state.db.collection("notes");
    let pages: Collection<Document> = state.db.collection("pages");
    let links: Collection<Document> = state.db.collection("links");
    let ai_translations: Collection<Document> = state.db.collection("ai_translations");

    let posts_stream = create_change_stream(&posts, "posts").await?;
    let notes_stream = create_change_stream(&notes, "notes").await?;
    let pages_stream = create_change_stream(&pages, "pages").await?;
    let links_stream = create_change_stream(&links, "links").await?;
    let translations_stream = create_change_stream(&ai_translations, "ai_translations").await?;

    tracing::info!(
        "✓ Change stream 监听已启动 - 正在监听: posts, notes, pages, links, ai_translations"
    );

    let state_posts = state.clone();
    tokio::spawn(async move {
        let mut stream = posts_stream;
        while let Some(result) = stream.next().await {
            match result {
                Ok(event) => {
                    if let Err(error) = handle_post_change(&state_posts, event).await {
                        tracing::error!("Failed to handle Post change: {}", error);
                    }
                }
                Err(error) => tracing::error!("Post change stream error: {}", error),
            }
        }
        tracing::warn!("Post change stream ended");
    });

    let state_notes = state.clone();
    tokio::spawn(async move {
        let mut stream = notes_stream;
        while let Some(result) = stream.next().await {
            match result {
                Ok(event) => {
                    if let Err(error) = handle_note_change(&state_notes, event).await {
                        tracing::error!("Failed to handle Note change: {}", error);
                    }
                }
                Err(error) => tracing::error!("Note change stream error: {}", error),
            }
        }
        tracing::warn!("Note change stream ended");
    });

    let state_pages = state.clone();
    tokio::spawn(async move {
        let mut stream = pages_stream;
        while let Some(result) = stream.next().await {
            match result {
                Ok(event) => {
                    if let Err(error) = handle_page_change(&state_pages, event).await {
                        tracing::error!("Failed to handle Page change: {}", error);
                    }
                }
                Err(error) => tracing::error!("Page change stream error: {}", error),
            }
        }
        tracing::warn!("Page change stream ended");
    });

    let state_translations = state.clone();
    tokio::spawn(async move {
        let mut stream = translations_stream;
        while let Some(result) = stream.next().await {
            match result {
                Ok(event) => {
                    if let Err(error) = handle_translation_change(&state_translations, event).await
                    {
                        tracing::error!("Failed to handle Translation change: {}", error);
                    }
                }
                Err(error) => tracing::error!("Translation change stream error: {}", error),
            }
        }
        tracing::warn!("Translation change stream ended");
    });

    let mut stream = links_stream;
    while let Some(result) = stream.next().await {
        match result {
            Ok(event) => {
                if let Err(error) = handle_link_change(&state, event).await {
                    tracing::error!("Failed to handle link change: {}", error);
                }
            }
            Err(error) => tracing::error!("Link change stream error: {}", error),
        }
    }

    Ok(())
}

async fn create_change_stream(
    collection: &Collection<Document>,
    collection_name: &str,
) -> Result<
    mongodb::change_stream::ChangeStream<
        mongodb::change_stream::event::ChangeStreamEvent<Document>,
    >,
    String,
> {
    collection
        .watch()
        .full_document(mongodb::options::FullDocumentType::UpdateLookup)
        .read_concern(mongodb::options::ReadConcern::majority())
        .await
        .map_err(|error| {
            if collection_name == "posts"
                && error
                    .to_string()
                    .contains("The $changeStream stage is only supported on replica sets")
            {
                "Change Stream 需要副本集配置！MongoDB 单实例不支持 Change Stream。请配置 MongoDB 为副本集或使用 MongoDB Atlas。".to_string()
            } else {
                format!("Failed to create {collection_name} change stream: {error}")
            }
        })
}
