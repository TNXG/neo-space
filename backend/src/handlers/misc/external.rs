//! External service handlers (nbnhhsh, nav aggregation)

use crate::{
    app::SharedState,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{Json, extract::State};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};

/// NBNHHSH guess request
#[derive(Debug, Deserialize, Serialize)]
pub struct NbnhhshGuessRequest {
    pub text: String,
}

/// NBNHHSH guess result
#[derive(Debug, Deserialize, Serialize)]
pub struct NbnhhshGuessResult {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub trans: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inputting: Option<Vec<String>>,
}

/// Proxy endpoint for nbnhhsh guess API (Chinese pinyin guessing)
pub async fn nbnhhsh_guess(
    State(state): State<SharedState>,
    AppJson(request): AppJson<NbnhhshGuessRequest>,
) -> Json<Vec<NbnhhshGuessResult>> {
    let result = state
        .http_client
        .post("https://lab.magiconch.com/api/nbnhhsh/guess")
        .json(&serde_json::json!({ "text": request.text }))
        .send()
        .await;

    match result {
        Ok(response) => {
            if let Ok(data) = response.json::<Vec<NbnhhshGuessResult>>().await {
                Json(data)
            } else {
                Json(vec![])
            }
        }
        Err(_) => Json(vec![]),
    }
}

// ============================================================
//  Aggregate Nav — single endpoint for nav hover dropdowns
//  Returns recent posts+notes (merged) + categories with counts
// ============================================================

#[derive(Debug, Deserialize)]
struct NavAggPost {
    #[serde(rename = "_id")]
    id: ObjectId,
    title: String,
    slug: String,
    #[serde(rename = "categoryId")]
    category_id: ObjectId,
    created: bson::DateTime,
}

#[derive(Debug, Deserialize)]
struct NavAggNote {
    #[serde(rename = "_id")]
    id: ObjectId,
    nid: i32,
    title: String,
    created: bson::DateTime,
}

/// A nav item (post or note) in the recent feed
#[derive(Debug, Serialize)]
pub struct NavAggItem {
    #[serde(rename = "type")]
    item_type: String,
    id: String,
    title: String,
    /// ISO 8601
    created: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    slug: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    category: Option<NavAggItemCategory>,
    #[serde(skip_serializing_if = "Option::is_none")]
    nid: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct NavAggItemCategory {
    name: String,
    slug: String,
}

/// Category entry with post count for the nav dropdown
#[derive(Debug, Serialize)]
pub struct NavAggCategory {
    #[serde(rename = "_id")]
    id: String,
    name: String,
    slug: String,
    #[serde(rename = "type")]
    category_type: i32,
    created: String,
    count: i64,
}

#[derive(Debug, Deserialize)]
pub struct NavAggParams {
    nav: Option<bool>,
}

/// Full nav aggregate response
#[derive(Debug, Serialize)]
pub struct NavAggResponse {
    recent: Vec<NavAggItem>,
    categories: Vec<NavAggCategory>,
}

/// GET /aggregate/nav
/// Returns merged recent posts+notes and all categories with post counts.
pub async fn aggregate_nav(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<NavAggParams>,
) -> AppResult<Json<ApiResponse<NavAggResponse>>> {
    const RECENT_SIZE: i64 = 5;

    // ── 1. Fetch all categories ──────────────────────────────
    let cats_coll = state.db.collection::<crate::models::Category>("categories");
    let cats_opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .build();
    let mut cats_cur = cats_coll
        .find(doc! {})
        .with_options(cats_opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut cat_map: std::collections::HashMap<ObjectId, crate::models::Category> =
        std::collections::HashMap::new();
    while let Some(cat) = cats_cur
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        cat_map.insert(cat.id, cat);
    }

    // ── 2. Count published posts per category (one aggregation) ──
    let count_pipeline = vec![
        doc! { "$match": { "isPublished": true } },
        doc! { "$group": { "_id": "$categoryId", "count": { "$sum": 1_i32 } } },
    ];
    let mut count_cur = state
        .db
        .collection::<bson::Document>("posts")
        .aggregate(count_pipeline)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut count_map: std::collections::HashMap<ObjectId, i64> = std::collections::HashMap::new();
    while let Some(doc) = count_cur
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        if let Some(bson::Bson::ObjectId(cat_id)) = doc.get("_id").cloned() {
            let count = match doc.get("count") {
                Some(bson::Bson::Int32(v)) => i64::from(*v),
                Some(bson::Bson::Int64(v)) => *v,
                _ => 0,
            };
            count_map.insert(cat_id, count);
        }
    }

    // ── 3. Build sorted categories list ──────────────────────
    let mut categories: Vec<NavAggCategory> = cat_map
        .values()
        .map(|cat| NavAggCategory {
            id: cat.id.to_hex(),
            name: cat.name.clone(),
            slug: cat.slug.clone(),
            category_type: cat.category_type,
            created: cat.created.to_chrono().to_rfc3339(),
            count: count_map.get(&cat.id).copied().unwrap_or(0),
        })
        .collect();
    categories.sort_by(|a, b| b.created.cmp(&a.created));

    categories.retain(|c| c.count > 0);

    // ── 4. Fetch recent posts ─────────────────────────────────
    let posts_coll = state.db.collection::<NavAggPost>("posts");
    let post_opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .limit(RECENT_SIZE)
        .projection(doc! { "title": 1, "slug": 1, "created": 1, "categoryId": 1 })
        .build();

    let mut post_cur = posts_coll
        .find(doc! { "isPublished": true })
        .with_options(post_opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut recent: Vec<NavAggItem> = Vec::new();
    while let Some(post) = post_cur
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        let cat = cat_map.get(&post.category_id);
        recent.push(NavAggItem {
            item_type: "post".to_string(),
            id: post.id.to_hex(),
            title: post.title,
            created: post.created.to_chrono().to_rfc3339(),
            slug: Some(post.slug),
            category: cat.map(|c| NavAggItemCategory {
                name: c.name.clone(),
                slug: c.slug.clone(),
            }),
            nid: None,
        });
    }

    // ── 5. Fetch recent notes ─────────────────────────────────
    let notes_coll = state.db.collection::<NavAggNote>("notes");
    let note_opts = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .limit(RECENT_SIZE)
        .projection(doc! { "title": 1, "nid": 1, "created": 1 })
        .build();

    let mut note_cur = notes_coll
        .find(doc! { "isPublished": true })
        .with_options(note_opts)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    while let Some(note) = note_cur
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        recent.push(NavAggItem {
            item_type: "note".to_string(),
            id: note.id.to_hex(),
            title: note.title,
            created: note.created.to_chrono().to_rfc3339(),
            slug: None,
            category: None,
            nid: Some(note.nid),
        });
    }

    // Newest first, cap at 6
    recent.sort_by(|a, b| b.created.cmp(&a.created));
    recent.truncate(6);

    Ok(Json(ApiResponse::success(NavAggResponse {
        recent,
        categories,
    })))
}
