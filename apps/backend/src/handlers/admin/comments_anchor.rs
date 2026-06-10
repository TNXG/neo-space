//! Resolve admin comment references against local content collections.

use std::collections::{HashMap, HashSet};

use crate::{
    error::{AppError, AppResult},
    handlers::admin::comments_data::{AdminCommentAnchor, AdminCommentItem, document_string},
};
use bson::{Document, doc, oid::ObjectId};
use futures::TryStreamExt;
use mongodb::Database;

pub async fn hydrate_anchors(db: &Database, items: &mut [AdminCommentItem]) -> AppResult<()> {
    let refs_by_type = collect_refs_by_type(items);
    let mut anchors = HashMap::new();

    hydrate_post_anchors(db, refs_by_type.get("post"), &mut anchors).await?;
    hydrate_page_anchors(db, refs_by_type.get("page"), &mut anchors).await?;
    hydrate_note_anchors(db, refs_by_type.get("note"), &mut anchors).await?;
    hydrate_recently_anchors(db, refs_by_type.get("recently"), &mut anchors).await?;

    for item in items {
        item.anchor = anchors
            .get(&(item.ref_type.clone(), item.r#ref.clone()))
            .cloned();
    }

    Ok(())
}

fn collect_refs_by_type(items: &[AdminCommentItem]) -> HashMap<String, Vec<ObjectId>> {
    let mut seen = HashSet::new();
    let mut refs_by_type: HashMap<String, Vec<ObjectId>> = HashMap::new();

    for item in items {
        let Ok(object_id) = ObjectId::parse_str(&item.r#ref) else {
            continue;
        };
        let key = (item.ref_type.clone(), item.r#ref.clone());
        if seen.insert(key) {
            refs_by_type
                .entry(item.ref_type.clone())
                .or_default()
                .push(object_id);
        }
    }

    refs_by_type
}

async fn hydrate_post_anchors(
    db: &Database,
    refs: Option<&Vec<ObjectId>>,
    anchors: &mut HashMap<(String, String), AdminCommentAnchor>,
) -> AppResult<()> {
    let Some(refs) = refs else {
        return Ok(());
    };

    let mut cursor = db
        .collection::<Document>("posts")
        .find(doc! { "_id": { "$in": refs } })
        .projection(doc! { "_id": 1, "title": 1, "slug": 1, "categoryId": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut posts = Vec::new();
    let mut category_ids = Vec::new();

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        if let Ok(category_id) = document.get_object_id("categoryId") {
            category_ids.push(category_id);
        }
        posts.push(document);
    }

    let category_slugs = load_category_slugs(db, category_ids).await?;
    for post in posts {
        let id = document_string(&post, &["_id"]).unwrap_or_default();
        let slug = document_string(&post, &["slug"]);
        let category_slug = post
            .get_object_id("categoryId")
            .ok()
            .and_then(|id| category_slugs.get(&id.to_hex()).cloned());
        let path = match (&category_slug, &slug) {
            (Some(category_slug), Some(slug)) => format!("/posts/{category_slug}/{slug}"),
            (_, Some(slug)) => format!("/posts/{slug}"),
            _ => format!("/posts/{id}"),
        };

        anchors.insert(
            ("post".to_string(), id),
            AdminCommentAnchor {
                title: document_string(&post, &["title"]),
                slug,
                category_slug,
                nid: None,
                path,
            },
        );
    }

    Ok(())
}

async fn load_category_slugs(
    db: &Database,
    category_ids: Vec<ObjectId>,
) -> AppResult<HashMap<String, String>> {
    if category_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let mut cursor = db
        .collection::<Document>("categories")
        .find(doc! { "_id": { "$in": category_ids } })
        .projection(doc! { "_id": 1, "slug": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;
    let mut slugs = HashMap::new();

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        if let (Some(id), Some(slug)) = (
            document_string(&document, &["_id"]),
            document_string(&document, &["slug"]),
        ) {
            slugs.insert(id, slug);
        }
    }

    Ok(slugs)
}

async fn hydrate_page_anchors(
    db: &Database,
    refs: Option<&Vec<ObjectId>>,
    anchors: &mut HashMap<(String, String), AdminCommentAnchor>,
) -> AppResult<()> {
    let Some(refs) = refs else {
        return Ok(());
    };

    let mut cursor = db
        .collection::<Document>("pages")
        .find(doc! { "_id": { "$in": refs } })
        .projection(doc! { "_id": 1, "title": 1, "slug": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        let id = document_string(&document, &["_id"]).unwrap_or_default();
        let slug = document_string(&document, &["slug"]);
        anchors.insert(
            ("page".to_string(), id.clone()),
            AdminCommentAnchor {
                title: document_string(&document, &["title"]),
                path: slug
                    .as_ref()
                    .map(|slug| format!("/pages/{slug}"))
                    .unwrap_or_else(|| format!("/pages/{id}")),
                slug,
                category_slug: None,
                nid: None,
            },
        );
    }

    Ok(())
}

async fn hydrate_note_anchors(
    db: &Database,
    refs: Option<&Vec<ObjectId>>,
    anchors: &mut HashMap<(String, String), AdminCommentAnchor>,
) -> AppResult<()> {
    let Some(refs) = refs else {
        return Ok(());
    };

    let mut cursor = db
        .collection::<Document>("notes")
        .find(doc! { "_id": { "$in": refs } })
        .projection(doc! { "_id": 1, "title": 1, "nid": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        let id = document_string(&document, &["_id"]).unwrap_or_default();
        let nid = document.get_i32("nid").ok();
        anchors.insert(
            ("note".to_string(), id.clone()),
            AdminCommentAnchor {
                title: document_string(&document, &["title"]),
                slug: None,
                category_slug: None,
                nid,
                path: nid
                    .map(|nid| format!("/notes/{nid}"))
                    .unwrap_or_else(|| format!("/notes/{id}")),
            },
        );
    }

    Ok(())
}

async fn hydrate_recently_anchors(
    db: &Database,
    refs: Option<&Vec<ObjectId>>,
    anchors: &mut HashMap<(String, String), AdminCommentAnchor>,
) -> AppResult<()> {
    let Some(refs) = refs else {
        return Ok(());
    };

    let mut cursor = db
        .collection::<Document>("recently")
        .find(doc! { "_id": { "$in": refs } })
        .projection(doc! { "_id": 1, "content": 1 })
        .await
        .map_err(|error| AppError::Database(error.to_string()))?;

    while let Some(document) = cursor
        .try_next()
        .await
        .map_err(|error| AppError::Database(error.to_string()))?
    {
        let id = document_string(&document, &["_id"]).unwrap_or_default();
        anchors.insert(
            ("recently".to_string(), id.clone()),
            AdminCommentAnchor {
                title: document_string(&document, &["content"]),
                slug: None,
                category_slug: None,
                nid: None,
                path: format!("/recently/{id}"),
            },
        );
    }

    Ok(())
}
