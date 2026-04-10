use std::collections::HashSet;

use futures::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};

use crate::app::SharedState;
use crate::external::search::SearchService;
use crate::models::{Note, Post};

use super::builders::{build_note_documents, build_post_documents};
use super::loaders::{
    fetch_category_map, fetch_category_translation_maps, fetch_note_translation_map,
    fetch_post_translation_map,
};
use super::operations::build_search_service;

/// Full sync: query all published posts and notes from `MongoDB`, bulk-index into `Meilisearch`.
/// Should be called once at startup.
pub async fn full_sync(state: SharedState) {
    tracing::info!("开始 Meilisearch 全量同步...");

    let search_service = match build_search_service(&state) {
        Ok(service) => service,
        Err(error) => {
            tracing::error!("全量同步: 创建 SearchService 失败: {error}");
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

    let post_ids = posts
        .iter()
        .map(|post| post.id.to_hex())
        .collect::<Vec<_>>();
    let category_ids = posts
        .iter()
        .map(|post| post.category_id)
        .collect::<HashSet<ObjectId>>()
        .into_iter()
        .collect::<Vec<_>>();
    let translation_map = fetch_post_translation_map(state, &post_ids).await;
    let languages = translation_map
        .keys()
        .map(|(_, lang)| lang.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
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

    let note_ids = notes
        .iter()
        .map(|note| note.id.to_hex())
        .collect::<Vec<_>>();
    let translation_map = fetch_note_translation_map(state, &note_ids).await;
    let docs = build_note_documents(notes, &translation_map);
    let count = docs.len();

    if let Err(error) = search_service.index_notes(docs).await {
        tracing::error!("全量同步: 同步笔记到 Meilisearch 失败: {:?}", error);
    } else {
        tracing::info!("已同步 {} 条笔记语言文档到 Meilisearch", count);
    }
}
