use std::collections::HashMap;

use mongodb::bson::oid::ObjectId;

use crate::external::search::{NoteDocument, PostDocument};
use crate::models::{AiTranslation, Category, Note, Post};

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

pub(super) fn build_post_documents(
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

pub(super) fn build_note_documents(
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
