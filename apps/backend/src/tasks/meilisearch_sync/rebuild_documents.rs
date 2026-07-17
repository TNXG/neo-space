use std::collections::HashSet;

use futures::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};

use crate::app::SharedState;
use crate::external::search::{NoteDocument, PostDocument};
use crate::models::{Note, Post};

use super::builders::{build_note_documents, build_post_documents};
use super::loaders::{
    fetch_category_map, fetch_category_translation_maps, fetch_note_translation_map,
    fetch_post_translation_map,
};

/// 从 MongoDB 构建全部公开文章的搜索文档，不修改线上索引。
pub(crate) async fn collect_post_documents(
    state: &SharedState,
) -> Result<Vec<PostDocument>, Box<dyn std::error::Error>> {
    let posts_col = state.db.collection::<Post>("posts");
    let filter = doc! { "isPublished": true };
    let posts: Vec<Post> = posts_col.find(filter).await?.try_collect().await?;

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

    Ok(build_post_documents(
        posts,
        &category_map,
        &category_translation_maps,
        &translation_map,
    ))
}

/// 从 MongoDB 构建全部公开笔记的搜索文档，不修改线上索引。
pub(crate) async fn collect_note_documents(
    state: &SharedState,
) -> Result<Vec<NoteDocument>, Box<dyn std::error::Error>> {
    let notes_col = state.db.collection::<Note>("notes");
    let filter = doc! { "isPublished": true };
    let notes: Vec<Note> = notes_col.find(filter).await?.try_collect().await?;

    let note_ids = notes
        .iter()
        .map(|note| note.id.to_hex())
        .collect::<Vec<_>>();
    let translation_map = fetch_note_translation_map(state, &note_ids).await;
    Ok(build_note_documents(notes, &translation_map))
}
