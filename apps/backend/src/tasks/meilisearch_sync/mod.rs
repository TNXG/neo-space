//! Meilisearch synchronization utilities

mod builders;
mod full_sync;
mod loaders;
mod operations;

use mongodb::bson::{Document, doc, oid::ObjectId};

use crate::app::SharedState;
use crate::models::{AiTranslation, Note, Post};

pub use full_sync::full_sync;
use operations::{
    build_search_service, replace_note_documents_for_ref, replace_post_documents_for_ref,
};

/// Sync post to `Meilisearch`.
pub(crate) async fn sync_post_to_meilisearch(
    state: &SharedState,
    doc: Option<&Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let document = doc.ok_or("Missing document")?;
    let post: Post = mongodb::bson::from_document(document.clone())?;
    let search_service = build_search_service(state)?;

    replace_post_documents_for_ref(state, &search_service, post).await
}

/// Sync note to `Meilisearch`.
pub(crate) async fn sync_note_to_meilisearch(
    state: &SharedState,
    doc: Option<&Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let document = doc.ok_or("Missing document")?;
    let note: Note = mongodb::bson::from_document(document.clone())?;
    let search_service = build_search_service(state)?;

    replace_note_documents_for_ref(state, &search_service, note).await
}

/// Sync translation change to `Meilisearch` by rebuilding the owning content's locale documents.
pub(crate) async fn sync_translation_to_meilisearch(
    state: &SharedState,
    doc: Option<&Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let document = doc.ok_or("Missing document")?;
    let translation: AiTranslation = mongodb::bson::from_document(document.clone())?;
    let search_service = build_search_service(state)?;

    match translation.ref_type.as_str() {
        "posts" => {
            let posts_collection = state.db.collection::<Post>("posts");
            if let Ok(object_id) = ObjectId::parse_str(&translation.ref_id)
                && let Some(post) = posts_collection
                    .find_one(doc! { "_id": object_id, "isPublished": true })
                    .await?
            {
                replace_post_documents_for_ref(state, &search_service, post).await?;
            }
        }
        "notes" => {
            let notes_collection = state.db.collection::<Note>("notes");
            if let Ok(object_id) = ObjectId::parse_str(&translation.ref_id)
                && let Some(note) = notes_collection
                    .find_one(doc! { "_id": object_id, "isPublished": true })
                    .await?
            {
                replace_note_documents_for_ref(state, &search_service, note).await?;
            }
        }
        _ => {}
    }

    Ok(())
}
