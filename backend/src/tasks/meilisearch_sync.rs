//! Meilisearch synchronization utilities

use crate::app::SharedState;
use crate::external::search::{NoteDocument, PostDocument, SearchService};
use crate::models::{AiTranslation, Category, Note, Post};
use crate::services::helpers::get_category_name_translation_map;
use futures::TryStreamExt;
use mongodb::bson::{Document, doc, oid::ObjectId};
use std::collections::{HashMap, HashSet};

fn boxed_error(message: impl Into<String>) -> Box<dyn std::error::Error> {
    message.into().into()
}

fn build_search_document_id(ref_id: &str, lang: &str) -> String {
    format!("{ref_id}:{lang}")
}

fn normalize_content_language(lang: &str) -> String {
    if lang.is_empty() {
        "zh".to_string()
    } else {
        lang.to_string()
    }
}

fn collect_latest_translations_by_ref_and_lang(
    translations: Vec<AiTranslation>,
) -> HashMap<(String, String), AiTranslation> {
    let mut translation_map = HashMap::new();

    for translation in translations {
        translation_map
            .entry((translation.ref_id.clone(), translation.lang.clone()))
            .or_insert(translation);
    }

    translation_map
}

async fn fetch_post_translation_map(
    state: &SharedState,
    post_ids: &[String],
) -> HashMap<(String, String), AiTranslation> {
    if post_ids.is_empty() {
        return HashMap::new();
    }

    let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
    let filter = doc! {
        "refId": { "$in": post_ids },
        "refType": "posts",
    };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "refId": 1, "lang": 1, "created": -1 })
        .build();

    match translations_collection
        .find(filter)
        .with_options(find_options)
        .await
    {
        Ok(cursor) => {
            let translations: Vec<AiTranslation> = cursor.try_collect().await.unwrap_or_default();
            collect_latest_translations_by_ref_and_lang(translations)
        }
        Err(error) => {
            tracing::error!(
                "Failed to fetch post translations for Meilisearch sync: {}",
                error
            );
            HashMap::new()
        }
    }
}

async fn fetch_note_translation_map(
    state: &SharedState,
    note_ids: &[String],
) -> HashMap<(String, String), AiTranslation> {
    if note_ids.is_empty() {
        return HashMap::new();
    }

    let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
    let filter = doc! {
        "refId": { "$in": note_ids },
        "refType": "notes",
    };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "refId": 1, "lang": 1, "created": -1 })
        .build();

    match translations_collection
        .find(filter)
        .with_options(find_options)
        .await
    {
        Ok(cursor) => {
            let translations: Vec<AiTranslation> = cursor.try_collect().await.unwrap_or_default();
            collect_latest_translations_by_ref_and_lang(translations)
        }
        Err(error) => {
            tracing::error!(
                "Failed to fetch note translations for Meilisearch sync: {}",
                error
            );
            HashMap::new()
        }
    }
}

async fn fetch_category_map(
    state: &SharedState,
    category_ids: &[ObjectId],
) -> HashMap<ObjectId, Category> {
    if category_ids.is_empty() {
        return HashMap::new();
    }

    let categories_collection = state.db.collection::<Category>("categories");
    let filter = doc! { "_id": { "$in": category_ids } };

    match categories_collection.find(filter).await {
        Ok(cursor) => cursor
            .try_collect::<Vec<Category>>()
            .await
            .unwrap_or_default()
            .into_iter()
            .map(|category| (category.id, category))
            .collect(),
        Err(error) => {
            tracing::error!("Failed to fetch categories for Meilisearch sync: {}", error);
            HashMap::new()
        }
    }
}

async fn fetch_category_translation_maps(
    state: &SharedState,
    category_ids: &[ObjectId],
    languages: &[String],
) -> HashMap<String, HashMap<String, String>> {
    let mut result = HashMap::new();

    for lang in languages.iter().filter(|lang| lang.as_str() != "zh") {
        let translation_map = get_category_name_translation_map(state, category_ids, lang).await;
        result.insert(lang.clone(), translation_map);
    }

    result
}

fn build_post_documents(
    posts: Vec<Post>,
    category_map: &HashMap<ObjectId, Category>,
    category_translation_maps: &HashMap<String, HashMap<String, String>>,
    translation_map: &HashMap<(String, String), AiTranslation>,
) -> Vec<PostDocument> {
    let mut documents = Vec::new();

    for post in posts {
        let ref_id = post.id.to_hex();
        let default_lang = normalize_content_language(&post.lang);
        let category = category_map.get(&post.category_id);

        documents.push(PostDocument {
            id: build_search_document_id(&ref_id, &default_lang),
            ref_id: ref_id.clone(),
            lang: default_lang.clone(),
            title: post.title.clone(),
            text: post.text.clone(),
            slug: post.slug.clone(),
            category: category.as_ref().map(|item| item.slug.clone()),
            category_name: category.as_ref().map(|item| item.name.clone()),
            tags: post.tags.clone(),
            created: post.created.timestamp_millis() / 1000,
        });

        for ((translation_ref_id, translation_lang), translation) in translation_map
            .iter()
            .filter(|((translation_ref_id, _), _)| translation_ref_id == &ref_id)
        {
            let localized_category_name = category.and_then(|item| {
                category_translation_maps
                    .get(translation_lang)
                    .and_then(|map| map.get(&item.id.to_hex()))
                    .cloned()
                    .or_else(|| Some(item.name.clone()))
            });

            documents.push(PostDocument {
                id: build_search_document_id(translation_ref_id, translation_lang),
                ref_id: translation_ref_id.clone(),
                lang: translation_lang.clone(),
                title: translation
                    .title
                    .clone()
                    .unwrap_or_else(|| post.title.clone()),
                text: translation
                    .text
                    .clone()
                    .unwrap_or_else(|| post.text.clone()),
                slug: post.slug.clone(),
                category: category.as_ref().map(|item| item.slug.clone()),
                category_name: localized_category_name,
                tags: if translation.tags.is_empty() {
                    post.tags.clone()
                } else {
                    translation.tags.clone()
                },
                created: post.created.timestamp_millis() / 1000,
            });
        }
    }

    documents
}

fn build_note_documents(
    notes: Vec<Note>,
    translation_map: &HashMap<(String, String), AiTranslation>,
) -> Vec<NoteDocument> {
    let mut documents = Vec::new();

    for note in notes {
        let ref_id = note.id.to_hex();
        let default_lang = normalize_content_language(&note.lang);

        documents.push(NoteDocument {
            id: build_search_document_id(&ref_id, &default_lang),
            ref_id: ref_id.clone(),
            lang: default_lang.clone(),
            title: note.title.clone(),
            text: note.text.clone(),
            nid: note.nid,
            created: note.created.timestamp_millis() / 1000,
        });

        for ((translation_ref_id, translation_lang), translation) in translation_map
            .iter()
            .filter(|((translation_ref_id, _), _)| translation_ref_id == &ref_id)
        {
            documents.push(NoteDocument {
                id: build_search_document_id(translation_ref_id, translation_lang),
                ref_id: translation_ref_id.clone(),
                lang: translation_lang.clone(),
                title: translation
                    .title
                    .clone()
                    .unwrap_or_else(|| note.title.clone()),
                text: translation
                    .text
                    .clone()
                    .unwrap_or_else(|| note.text.clone()),
                nid: note.nid,
                created: note.created.timestamp_millis() / 1000,
            });
        }
    }

    documents
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

    let url = format!("{}/indexes/{}/documents/delete", host, index);
    let mut request = client
        .post(&url)
        .json(&serde_json::json!({ "filter": filter }));

    if let Some(key) = api_key {
        request = request.header("Authorization", format!("Bearer {}", key));
    }

    let response = request.send().await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Meilisearch delete by filter error: {} - {}", status, body).into());
    }

    Ok(())
}

async fn replace_post_documents_for_ref(
    state: &SharedState,
    search_service: &SearchService,
    post: Post,
) -> Result<(), Box<dyn std::error::Error>> {
    let post_id = post.id.to_hex();
    let category_ids = vec![post.category_id];
    let category_map = fetch_category_map(state, &category_ids).await;
    let translation_map = fetch_post_translation_map(state, std::slice::from_ref(&post_id)).await;

    let language_set: HashSet<String> = translation_map
        .keys()
        .map(|(_, lang)| lang.clone())
        .collect();
    let languages: Vec<String> = language_set.into_iter().collect();
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
        &format!("ref_id = \"{}\"", post_id),
    )
    .await?;
    search_service
        .index_posts(docs)
        .await
        .map_err(|error| boxed_error(format!("{:?}", error)))?;
    Ok(())
}

async fn replace_note_documents_for_ref(
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
        &format!("ref_id = \"{}\"", note_id),
    )
    .await?;
    search_service
        .index_notes(docs)
        .await
        .map_err(|error| boxed_error(format!("{:?}", error)))?;
    Ok(())
}

/// Sync post to Meilisearch
pub(crate) async fn sync_post_to_meilisearch(
    state: &SharedState,
    doc: &Option<Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let document = doc.as_ref().ok_or("Missing document")?;
    let post: Post = mongodb::bson::from_document(document.clone())?;

    let api_key = if state.config.meilisearch_api_key.is_empty() {
        None
    } else {
        Some(state.config.meilisearch_api_key.clone())
    };
    let search_service = SearchService::new(state.config.meilisearch_host.clone(), api_key)
        .map_err(|error| boxed_error(format!("{:?}", error)))?;

    replace_post_documents_for_ref(state, &search_service, post).await
}

/// Sync note to Meilisearch
pub(crate) async fn sync_note_to_meilisearch(
    state: &SharedState,
    doc: &Option<Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let document = doc.as_ref().ok_or("Missing document")?;
    let note: Note = mongodb::bson::from_document(document.clone())?;

    let api_key = if state.config.meilisearch_api_key.is_empty() {
        None
    } else {
        Some(state.config.meilisearch_api_key.clone())
    };
    let search_service = SearchService::new(state.config.meilisearch_host.clone(), api_key)
        .map_err(|error| boxed_error(format!("{:?}", error)))?;

    replace_note_documents_for_ref(state, &search_service, note).await
}

/// Sync translation change to Meilisearch by rebuilding the owning content's locale documents.
pub(crate) async fn sync_translation_to_meilisearch(
    state: &SharedState,
    doc: &Option<Document>,
) -> Result<(), Box<dyn std::error::Error>> {
    let document = doc.as_ref().ok_or("Missing document")?;
    let translation: AiTranslation = mongodb::bson::from_document(document.clone())?;

    let api_key = if state.config.meilisearch_api_key.is_empty() {
        None
    } else {
        Some(state.config.meilisearch_api_key.clone())
    };
    let search_service = SearchService::new(state.config.meilisearch_host.clone(), api_key)
        .map_err(|error| boxed_error(format!("{:?}", error)))?;

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

/// Full sync: query all published posts and notes from MongoDB, bulk-index into Meilisearch.
/// Should be called once at startup.
pub async fn full_sync(state: SharedState) {
    tracing::info!("开始 Meilisearch 全量同步...");

    let api_key = if state.config.meilisearch_api_key.is_empty() {
        None
    } else {
        Some(state.config.meilisearch_api_key.clone())
    };

    let search_service = match SearchService::new(state.config.meilisearch_host.clone(), api_key) {
        Ok(service) => service,
        Err(error) => {
            tracing::error!("全量同步: 创建 SearchService 失败: {:?}", error);
            return;
        }
    };

    if let Err(error) = search_service.init_indexes().await {
        tracing::error!("全量同步: 初始化索引失败: {:?}", error);
        return;
    }

    if let Err(error) = search_service.clear_indexes().await {
        tracing::error!("全量同步: 清空索引失败: {:?}", error);
        return;
    }

    sync_posts(&state, &search_service).await;
    sync_notes(&state, &search_service).await;

    tracing::info!("Meilisearch 全量同步完成");
}

async fn sync_posts(state: &SharedState, search_service: &SearchService) {
    let posts_col = state.db.collection::<Post>("posts");
    let filter = doc! { "isPublished": true };
    let cursor = match posts_col.find(filter).await {
        Ok(cursor) => cursor,
        Err(error) => {
            tracing::error!("全量同步: 查询文章失败: {}", error);
            return;
        }
    };

    let posts: Vec<Post> = match cursor.try_collect().await {
        Ok(posts) => posts,
        Err(error) => {
            tracing::error!("全量同步: 读取文章失败: {}", error);
            return;
        }
    };

    let post_ids: Vec<String> = posts.iter().map(|post| post.id.to_hex()).collect();
    let category_ids: Vec<ObjectId> = posts
        .iter()
        .map(|post| post.category_id)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let translation_map = fetch_post_translation_map(state, &post_ids).await;
    let languages: Vec<String> = translation_map
        .keys()
        .map(|(_, lang)| lang.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect();
    let category_map = fetch_category_map(state, &category_ids).await;
    let category_translation_maps =
        fetch_category_translation_maps(state, &category_ids, &languages).await;

    let docs = build_post_documents(
        posts,
        &category_map,
        &category_translation_maps,
        &translation_map,
    );
    let count = docs.len();

    if let Err(error) = search_service.index_posts(docs).await {
        tracing::error!("全量同步: 同步文章到 Meilisearch 失败: {:?}", error);
    } else {
        tracing::info!("已同步 {} 条文章语言文档到 Meilisearch", count);
    }
}

async fn sync_notes(state: &SharedState, search_service: &SearchService) {
    let notes_col = state.db.collection::<Note>("notes");
    let filter = doc! { "isPublished": true };
    let cursor = match notes_col.find(filter).await {
        Ok(cursor) => cursor,
        Err(error) => {
            tracing::error!("全量同步: 查询笔记失败: {}", error);
            return;
        }
    };

    let notes: Vec<Note> = match cursor.try_collect().await {
        Ok(notes) => notes,
        Err(error) => {
            tracing::error!("全量同步: 读取笔记失败: {}", error);
            return;
        }
    };

    let note_ids: Vec<String> = notes.iter().map(|note| note.id.to_hex()).collect();
    let translation_map = fetch_note_translation_map(state, &note_ids).await;
    let docs = build_note_documents(notes, &translation_map);
    let count = docs.len();

    if let Err(error) = search_service.index_notes(docs).await {
        tracing::error!("全量同步: 同步笔记到 Meilisearch 失败: {:?}", error);
    } else {
        tracing::info!("已同步 {} 条笔记语言文档到 Meilisearch", count);
    }
}
