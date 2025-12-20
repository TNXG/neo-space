use rocket::{State, serde::json::Json, http::Status};
use mongodb::Database;
use mongodb::bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use std::str::FromStr;
use serde::{Deserialize, Serialize};

use crate::models::{Note, ApiResponse, PaginatedResponse, PaginatedData, Pagination, AiSummary};

/// Helper function to get the latest AI summary for a given ref ID
async fn get_ai_summary(db: &Database, ref_id: &str, lang: &str) -> Option<String> {
    let ai_summaries_collection = db.collection::<AiSummary>("ai_summaries");
    
    // Find the latest AI summary for this ref_id and language
    let filter = doc! { 
        "refId": ref_id,
        "lang": lang
    };
    
    let find_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "created": -1 }) // Get the latest one
        .build();
    
    match ai_summaries_collection.find_one(filter).with_options(find_options.clone()).await {
        Ok(Some(ai_summary)) => Some(ai_summary.summary),
        Ok(None) => {
            // If no summary found for the requested language, try to get any summary
            let fallback_filter = doc! { "refId": ref_id };
            match ai_summaries_collection.find_one(fallback_filter).with_options(find_options).await {
                Ok(Some(ai_summary)) => Some(ai_summary.summary),
                _ => None,
            }
        }
        Err(_) => None,
    }
}

/// List published notes with pagination
#[get("/notes?<page>&<size>")]
pub async fn list_notes(
    db: &State<Database>,
    page: Option<i64>,
    size: Option<i64>,
) -> Result<Json<PaginatedResponse<Note>>, Status> {
    let page = page.unwrap_or(1).max(1);
    let size = size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = db.collection::<Note>("notes");
    
    // Query only published notes, sorted by creation date (newest first)
    let filter = doc! { "isPublished": true };
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip as u64)
        .limit(size)
        .build();

    // Get total count
    let total = collection.count_documents(filter.clone()).await
        .map_err(|e| {
            eprintln!("Error counting documents: {:?}", e);
            Status::InternalServerError
        })?;

    // Fetch notes
    let mut cursor = collection.find(filter).with_options(find_options).await
        .map_err(|e| {
            eprintln!("Error finding documents: {:?}", e);
            Status::InternalServerError
        })?;

    let mut items = Vec::new();
    while let Some(mut note) = cursor.try_next().await.map_err(|e| {
        eprintln!("Error deserializing note: {:?}", e);
        Status::InternalServerError
    })? {
        // Fetch AI summary (default to Chinese)
        note.ai_summary = get_ai_summary(db, &note.id.to_hex(), "zh").await;
        
        items.push(note);
    }

    let total_page = (total as f64 / size as f64).ceil() as i64;
    let pagination = Pagination {
        total: total as i64,
        current_page: page,
        total_page,
        size,
        has_next_page: page < total_page,
        has_prev_page: page > 1,
    };

    Ok(Json(ApiResponse::success(PaginatedData { items, pagination })))
}

/// Get note by ID
#[get("/notes/<id>")]
pub async fn get_note_by_id(
    db: &State<Database>,
    id: String,
) -> Result<Json<ApiResponse<Note>>, Status> {
    let object_id = ObjectId::from_str(&id).map_err(|_| Status::BadRequest)?;
    
    let collection = db.collection::<Note>("notes");
    let mut note = collection.find_one(doc! { "_id": object_id, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    // Fetch AI summary (default to Chinese)
    note.ai_summary = get_ai_summary(db, &note.id.to_hex(), "zh").await;

    Ok(Json(ApiResponse::success(note)))
}

/// Get note by numeric ID (nid)
#[get("/notes/nid/<nid>")]
pub async fn get_note_by_nid(
    db: &State<Database>,
    nid: i32,
) -> Result<Json<ApiResponse<Note>>, Status> {
    let collection = db.collection::<Note>("notes");
    let mut note = collection.find_one(doc! { "nid": nid, "isPublished": true }).await
        .map_err(|_| Status::InternalServerError)?
        .ok_or(Status::NotFound)?;

    // Fetch AI summary (default to Chinese)
    note.ai_summary = get_ai_summary(db, &note.id.to_hex(), "zh").await;

    Ok(Json(ApiResponse::success(note)))
}

/// Get adjacent notes (previous and next) by nid
#[derive(Debug, Serialize, Deserialize)]
pub struct AdjacentNotes {
    pub prev: Option<AdjacentNote>,
    pub next: Option<AdjacentNote>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdjacentNote {
    pub nid: i32,
    pub title: String,
}

/// Minimal note structure for projection queries
#[derive(Debug, Serialize, Deserialize)]
struct MinimalNote {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub nid: i32,
    pub title: String,
}

#[get("/notes/nid/<nid>/adjacent")]
pub async fn get_adjacent_notes(
    db: &State<Database>,
    nid: i32,
) -> Result<Json<ApiResponse<AdjacentNotes>>, Status> {
    let collection = db.collection::<MinimalNote>("notes");
    
    // Find previous note (smaller nid, get the largest one)
    let prev_filter = doc! { 
        "nid": { "$lt": nid },
        "isPublished": true 
    };
    let prev_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "nid": -1 })
        .build();
    
    let prev_note = collection.find_one(prev_filter)
        .with_options(prev_options)
        .await
        .map_err(|e| {
            eprintln!("Error finding previous note: {:?}", e);
            Status::InternalServerError
        })?;
    
    // Find next note (larger nid, get the smallest one)
    let next_filter = doc! { 
        "nid": { "$gt": nid },
        "isPublished": true 
    };
    let next_options = mongodb::options::FindOneOptions::builder()
        .sort(doc! { "nid": 1 })
        .build();
    
    let next_note = collection.find_one(next_filter)
        .with_options(next_options)
        .await
        .map_err(|e| {
            eprintln!("Error finding next note: {:?}", e);
            Status::InternalServerError
        })?;
    
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
    
    Ok(Json(ApiResponse::success(adjacent)))
}
