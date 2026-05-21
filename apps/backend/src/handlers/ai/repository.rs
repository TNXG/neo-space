use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use bson::{doc, oid::ObjectId};

use crate::{
    app::SharedState,
    error::AppError,
    models::{AiTranslation, *},
};

use super::types::TimeCapsule;

fn to_translation_ref_type(ref_type: &str) -> Option<&'static str> {
    match ref_type {
        "post" => Some("posts"),
        "note" => Some("notes"),
        "page" => Some("pages"),
        _ => None,
    }
}

pub(super) async fn fetch_content_text(
    state: &SharedState,
    ref_id: &str,
    ref_type: &str,
    lang: &str,
) -> Result<(String, String, String), AppError> {
    let object_id = match ObjectId::parse_str(ref_id) {
        Ok(object_id) => object_id,
        Err(_) => {
            return Err(AppError::BadRequest(
                "AI time capsule feature is only available for database content".to_string(),
            ));
        }
    };

    let original_content = match ref_type {
        "post" => {
            let collection = state.db.collection::<Post>("posts");
            let post = collection
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .ok_or_else(|| AppError::NotFound("Post not found".to_string()))?;
            format!("{}\n\n{}", post.title, post.text)
        }
        "note" => {
            let collection = state.db.collection::<Note>("notes");
            let note = collection
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .ok_or_else(|| AppError::NotFound("Note not found".to_string()))?;
            format!("{}\n\n{}", note.title, note.text)
        }
        "page" => {
            let collection = state.db.collection::<Page>("pages");
            let page = collection
                .find_one(doc! { "_id": object_id })
                .await
                .map_err(|error| AppError::Database(error.to_string()))?
                .ok_or_else(|| AppError::NotFound("Page not found".to_string()))?;
            format!("{}\n\n{}", page.title, page.text)
        }
        _ => {
            return Err(AppError::BadRequest(format!(
                "Invalid ref type: {}",
                ref_type
            )));
        }
    };

    if lang == "zh" {
        return Ok((original_content, "zh".to_string(), "zh".to_string()));
    }

    let Some(translation_ref_type) = to_translation_ref_type(ref_type) else {
        return Ok((original_content, "zh".to_string(), "zh".to_string()));
    };

    let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
    let translation = translations_collection
        .find_one(doc! {
            "refId": ref_id,
            "refType": translation_ref_type,
            "lang": lang
        })
        .with_options(
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created": -1 })
                .build(),
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    if let Some(translation) = translation
        && let (Some(title), Some(text)) = (translation.title, translation.text)
    {
        return Ok((
            format!("{}\n\n{}", title, text),
            translation.lang,
            translation.source_lang,
        ));
    }

    Ok((original_content, "zh".to_string(), "zh".to_string()))
}

fn capsule_language_filter(ref_id: &str, ref_type: &str, lang: &str) -> bson::Document {
    if lang == "zh" {
        doc! {
            "refId": ref_id,
            "refType": ref_type,
            "$or": [
                { "lang": "zh" },
                { "lang": { "$exists": false } }
            ]
        }
    } else {
        doc! {
            "refId": ref_id,
            "refType": ref_type,
            "lang": lang
        }
    }
}

pub(super) async fn load_cached_capsule(
    collection: &mongodb::Collection<TimeCapsule>,
    ref_id: &str,
    ref_type: &str,
    lang: &str,
) -> Result<Option<TimeCapsule>, AppError> {
    collection
        .find_one(capsule_language_filter(ref_id, ref_type, lang))
        .with_options(
            mongodb::options::FindOneOptions::builder()
                .sort(doc! { "created": -1 })
                .build(),
        )
        .await
        .map_err(|error| AppError::Database(error.to_string()))
}

pub(super) fn hash_content(content: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}
