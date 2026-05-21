use std::collections::HashSet;

use crate::app::SharedState;
use crate::external::search::SearchService;
use crate::models::{Note, Post};

use super::builders::{build_note_documents, build_post_documents};
use super::loaders::{
    fetch_category_map, fetch_category_translation_maps, fetch_note_translation_map,
    fetch_post_translation_map,
};

fn boxed_error(message: impl Into<String>) -> Box<dyn std::error::Error> {
    message.into().into()
}

pub(super) fn build_search_service(
    state: &SharedState,
) -> Result<SearchService, Box<dyn std::error::Error>> {
    let api_key = (!state.config.meilisearch_api_key.is_empty())
        .then(|| state.config.meilisearch_api_key.clone());

    SearchService::new(state.config.meilisearch_host.clone(), api_key)
        .map_err(|error| boxed_error(format!("{error:?}")))
}

async fn delete_documents_by_filter(
    client: &reqwest::Client,
    index: &str,
    filter: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let host = std::env::var("MEILISEARCH_URL")
        .or_else(|_| std::env::var("MEILISEARCH_HOST"))
        .unwrap_or_else(|_| "http://localhost:7700".to_string());
    let api_key = std::env::var("MEILISEARCH_API_KEY").ok();

    let url = format!("{host}/indexes/{index}/documents/delete");
    let mut request = client
        .post(&url)
        .json(&serde_json::json!({ "filter": filter }));

    if let Some(key) = api_key {
        request = request.header("Authorization", format!("Bearer {key}"));
    }

    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Meilisearch delete by filter error: {status} - {body}").into());
    }

    Ok(())
}

pub(super) async fn replace_post_documents_for_ref(
    state: &SharedState,
    search_service: &SearchService,
    post: Post,
) -> Result<(), Box<dyn std::error::Error>> {
    let post_id = post.id.to_hex();
    let category_ids = vec![post.category_id];
    let category_map = fetch_category_map(state, &category_ids).await;
    let translation_map = fetch_post_translation_map(state, std::slice::from_ref(&post_id)).await;

    let languages = translation_map
        .keys()
        .map(|(_, lang)| lang.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let category_translation_maps =
        fetch_category_translation_maps(state, &category_ids, &languages).await;

    let docs = build_post_documents(
        vec![post],
        &category_map,
        &category_translation_maps,
        &translation_map,
    );

    delete_documents_by_filter(
        &state.http_client,
        "posts",
        &format!("ref_id = \"{post_id}\""),
    )
    .await?;
    search_service
        .index_posts(docs)
        .await
        .map_err(|error| boxed_error(format!("{error:?}")))?;
    Ok(())
}

pub(super) async fn replace_note_documents_for_ref(
    state: &SharedState,
    search_service: &SearchService,
    note: Note,
) -> Result<(), Box<dyn std::error::Error>> {
    let note_id = note.id.to_hex();
    let translation_map = fetch_note_translation_map(state, std::slice::from_ref(&note_id)).await;
    let docs = build_note_documents(vec![note], &translation_map);

    delete_documents_by_filter(
        &state.http_client,
        "notes",
        &format!("ref_id = \"{note_id}\""),
    )
    .await?;
    search_service
        .index_notes(docs)
        .await
        .map_err(|error| boxed_error(format!("{error:?}")))?;
    Ok(())
}
