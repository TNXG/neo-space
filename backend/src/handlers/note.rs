//! Note handlers

use crate::services::helpers::get_ai_summary;
use crate::{
    app::SharedState,
    error::{AppError, AppQuery, AppResult},
    models::*,
};
use axum::{
    extract::{Path, State},
    response::Json,
};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ListNotesParams {
    page: Option<u64>,
    size: Option<u64>,
}

#[derive(Debug, Serialize)]
pub struct AdjacentNotes {
    pub prev: Option<AdjacentNote>,
    pub next: Option<AdjacentNote>,
}

#[derive(Debug, Serialize)]
pub struct AdjacentNote {
    pub nid: i32,
    pub title: String,
}

/// Minimal note structure for projection queries
#[derive(Debug, Serialize, Deserialize, Clone)]
struct MinimalNote {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub nid: i32,
    pub title: String,
}

/// List published notes with pagination
pub async fn list_notes(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<ListNotesParams>,
) -> AppResult<Json<ApiResponse<PaginatedData<Note>>>> {
    let page = params.page.unwrap_or(1).max(1);
    let size = params.size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = state.db.collection::<Note>("notes");

    let filter = doc! { "isPublished": true };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip)
        .limit(size as i64)
        .build();

    let total = collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut cursor = collection
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut items: Vec<Note> = Vec::new();
    while let Some(note) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        items.push(note);
    }

    // Batch-fetch AI summaries using $in query (avoids N+1)
    if !items.is_empty() {
        let note_ids: Vec<String> = items.iter().map(|n| n.id.to_hex()).collect();
        let ai_collection = state.db.collection::<AiSummary>("ai_summaries");
        let ai_filter = doc! {
            "refId": { "$in": &note_ids },
            "lang": "zh"
        };
        let ai_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "created": -1 })
            .build();

        if let Ok(mut ai_cursor) = ai_collection.find(ai_filter).with_options(ai_options).await {
            let mut summary_map: std::collections::HashMap<String, String> =
                std::collections::HashMap::new();
            while let Ok(Some(ai_summary)) = ai_cursor.try_next().await {
                summary_map
                    .entry(ai_summary.ref_id.clone())
                    .or_insert(ai_summary.summary);
            }
            for note in &mut items {
                note.ai_summary = summary_map.get(&note.id.to_hex()).cloned();
            }
        }
    }

    let total_page = ((total as f64) / (size as f64)).ceil() as i64;
    let pagination = Pagination {
        total: total as i64,
        current_page: page as i64,
        total_page,
        size: size as i64,
        has_next_page: page < total_page as u64,
        has_prev_page: page > 1,
    };

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: PaginatedData { items, pagination },
    }))
}

/// Get note by ID
pub async fn get_note(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<Note>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Note>("notes");
    let mut note = collection
        .find_one(doc! { "_id": object_id, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Note not found".to_string()))?;

    // Fetch AI summary (default to Chinese)
    note.ai_summary = get_ai_summary(&state, &note.id.to_hex(), "zh").await;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: note,
    }))
}

/// Get note by numeric ID (nid)
pub async fn get_note_by_nid(
    State(state): State<SharedState>,
    Path(nid): Path<i32>,
) -> AppResult<Json<ApiResponse<Note>>> {
    let collection = state.db.collection::<Note>("notes");
    let mut note = collection
        .find_one(doc! { "nid": nid, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Note not found".to_string()))?;

    // Fetch AI summary (default to Chinese)
    note.ai_summary = get_ai_summary(&state, &note.id.to_hex(), "zh").await;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: note,
    }))
}

/// Get adjacent notes (previous and next) by nid
pub async fn get_adjacent_notes(
    State(state): State<SharedState>,
    Path(nid): Path<i32>,
) -> AppResult<Json<ApiResponse<AdjacentNotes>>> {
    let collection = state.db.collection::<MinimalNote>("notes");

    // Find previous note (smaller nid, get the largest one)
    let prev_filter = doc! {
        "nid": { "$lt": nid },
        "isPublished": true
    };
    let prev_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "nid": -1 })
        .build();

    let prev_note = collection
        .find_one(prev_filter)
        .with_options(prev_options)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Find next note (larger nid, get the smallest one)
    let next_filter = doc! {
        "nid": { "$gt": nid },
        "isPublished": true
    };
    let next_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "nid": 1 })
        .build();

    let next_note = collection
        .find_one(next_filter)
        .with_options(next_options)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let adjacent = AdjacentNotes {
        prev: prev_note.map(|note| AdjacentNote {
            nid: note.nid,
            title: note.title,
        }),
        next: next_note.map(|note| AdjacentNote {
            nid: note.nid,
            title: note.title,
        }),
    };

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: adjacent,
    }))
}
