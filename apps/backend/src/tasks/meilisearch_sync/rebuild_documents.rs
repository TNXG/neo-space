//! 从 MongoDB 事实源生成全量 Meilisearch 搜索文档。

use std::collections::HashSet;

use bson::{doc, oid::ObjectId};
use futures::TryStreamExt;

use crate::{
    app::SharedState,
    error::{AppError, AppResult},
    external::search::{NoteDocument, PostDocument},
    models::{Note, Post},
};

use super::{
    builders::{build_note_documents, build_post_documents},
    loaders::{
        fetch_category_map, fetch_category_translation_maps, fetch_note_translation_map,
        fetch_post_translation_map,
    },
};

/// 从 MongoDB 读取全部已发布文章，并生成包含翻译与分类信息的搜索文档。
pub async fn collect_post_documents(state: &SharedState) -> AppResult<Vec<PostDocument>> {
    let posts = state
        .db
        .collection::<Post>("posts")
        .find(doc! { "isPublished": true })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
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
        .map(|(_, language)| language.clone())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let category_map = fetch_category_map(state, &category_ids).await;
    let category_translation_maps =
        fetch_category_translation_maps(state, &category_ids, &languages).await;

    Ok(build_post_documents(
        posts,
        &category_map,
        &category_translation_maps,
        &translation_map,
    ))
}

/// 从 MongoDB 读取全部已发布手记，并生成包含翻译内容的搜索文档。
pub async fn collect_note_documents(state: &SharedState) -> AppResult<Vec<NoteDocument>> {
    let notes = state
        .db
        .collection::<Note>("notes")
        .find(doc! { "isPublished": true })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
        .try_collect::<Vec<_>>()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let note_ids = notes
        .iter()
        .map(|note| note.id.to_hex())
        .collect::<Vec<_>>();
    let translation_map = fetch_note_translation_map(state, &note_ids).await;

    Ok(build_note_documents(notes, &translation_map))
}
