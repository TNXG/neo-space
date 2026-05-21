//! Note handlers

use crate::services::helpers::{
    apply_translation_to_note, get_ai_summary, get_ai_translation, get_dict_translation_map,
    localize_note_taxonomy_fields,
};
use crate::{
    app::SharedState,
    error::{AppError, AppJson, AppQuery, AppResult},
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
    lang: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DetailNoteParams {
    lang: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UnlockNoteRequest {
    password: String,
    lang: Option<String>,
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

fn is_protected_note(note: &Note) -> bool {
    note.password
        .as_ref()
        .is_some_and(|password| !password.is_empty())
}

fn strip_protected_fields(note: &mut Note) {
    note.password = None;
    note.encrypted_text = None;
}

fn redact_protected_note(note: &mut Note) {
    note.is_encrypted = is_protected_note(note);
    strip_protected_fields(note);

    if note.is_encrypted {
        note.text = String::new();
        note.ai_summary = None;
    }
}

/// List published notes with pagination
pub async fn list_notes(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<ListNotesParams>,
) -> AppResult<Json<ApiResponse<PaginatedData<Note>>>> {
    let page = params.page.unwrap_or(1).max(1);
    let size = params.size.unwrap_or(10).clamp(1, 100);
    let lang = params.lang.as_deref().unwrap_or("zh");
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

    let mood_source_texts: Vec<String> =
        items.iter().filter_map(|note| note.mood.clone()).collect();
    let weather_source_texts: Vec<String> = items
        .iter()
        .filter_map(|note| note.weather.clone())
        .collect();
    let mood_translation_map =
        get_dict_translation_map(&state, "note.mood", lang, &mood_source_texts).await;
    let weather_translation_map =
        get_dict_translation_map(&state, "note.weather", lang, &weather_source_texts).await;
    localize_note_taxonomy_fields(
        items.iter_mut(),
        &mood_translation_map,
        &weather_translation_map,
    );

    // Batch-fetch AI summaries using $in query (avoids N+1)
    if !items.is_empty() {
        let note_ids: Vec<String> = items.iter().map(|n| n.id.to_hex()).collect();
        let ai_collection = state.db.collection::<AiSummary>("ai_summaries");
        let summary_langs = if lang == "zh" {
            vec!["zh"]
        } else {
            vec![lang, "zh"]
        };
        let ai_filter = doc! {
            "refId": { "$in": &note_ids },
            "lang": { "$in": &summary_langs }
        };
        let ai_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "refId": 1, "created": -1 })
            .build();

        if let Ok(mut ai_cursor) = ai_collection.find(ai_filter).with_options(ai_options).await {
            let mut summary_map: std::collections::HashMap<String, String> =
                std::collections::HashMap::new();
            let mut zh_fallback_map: std::collections::HashMap<String, String> =
                std::collections::HashMap::new();
            while let Ok(Some(ai_summary)) = ai_cursor.try_next().await {
                if ai_summary.lang == lang {
                    summary_map
                        .entry(ai_summary.ref_id.clone())
                        .or_insert(ai_summary.summary.clone());
                    continue;
                }

                if ai_summary.lang == "zh" {
                    zh_fallback_map
                        .entry(ai_summary.ref_id.clone())
                        .or_insert(ai_summary.summary);
                }
            }

            for (ref_id, summary) in zh_fallback_map {
                summary_map.entry(ref_id).or_insert(summary);
            }

            for note in &mut items {
                note.ai_summary = summary_map.get(&note.id.to_hex()).cloned();
            }
        }
    }

    if lang != "zh" && !items.is_empty() {
        let note_ids: Vec<String> = items.iter().map(|n| n.id.to_hex()).collect();
        let translations_collection = state.db.collection::<AiTranslation>("ai_translations");
        let translation_filter = doc! {
            "refId": { "$in": &note_ids },
            "refType": "notes",
            "lang": lang
        };
        let translation_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "refId": 1, "created": -1 })
            .build();

        if let Ok(mut translation_cursor) = translations_collection
            .find(translation_filter)
            .with_options(translation_options)
            .await
        {
            let mut translation_map: std::collections::HashMap<String, AiTranslation> =
                std::collections::HashMap::new();
            while let Ok(Some(translation)) = translation_cursor.try_next().await {
                translation_map
                    .entry(translation.ref_id.clone())
                    .or_insert(translation);
            }

            for note in &mut items {
                if let Some(translation) = translation_map.get(&note.id.to_hex()) {
                    apply_translation_to_note(note, translation);
                }
            }
        }
    }

    for note in &mut items {
        redact_protected_note(note);
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
    AppQuery(params): AppQuery<DetailNoteParams>,
) -> AppResult<Json<ApiResponse<Note>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Note>("notes");
    let mut note = collection
        .find_one(doc! { "_id": object_id, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Note not found".to_string()))?;

    let note_id = note.id.to_hex();
    let lang = params.lang.as_deref().unwrap_or("zh");

    let mood_translation_map = get_dict_translation_map(
        &state,
        "note.mood",
        lang,
        &note.mood.iter().cloned().collect::<Vec<_>>(),
    )
    .await;
    let weather_translation_map = get_dict_translation_map(
        &state,
        "note.weather",
        lang,
        &note.weather.iter().cloned().collect::<Vec<_>>(),
    )
    .await;
    localize_note_taxonomy_fields(
        std::iter::once(&mut note),
        &mood_translation_map,
        &weather_translation_map,
    );

    note.ai_summary = get_ai_summary(&state, &note_id, lang).await;
    if let Some(translation) = get_ai_translation(&state, &note_id, "notes", lang).await {
        apply_translation_to_note(&mut note, &translation);
    }
    if is_protected_note(&note) {
        return Err(AppError::Forbidden);
    }
    strip_protected_fields(&mut note);

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
    AppQuery(params): AppQuery<DetailNoteParams>,
) -> AppResult<Json<ApiResponse<Note>>> {
    let collection = state.db.collection::<Note>("notes");
    let mut note = collection
        .find_one(doc! { "nid": nid, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Note not found".to_string()))?;

    let note_id = note.id.to_hex();
    let lang = params.lang.as_deref().unwrap_or("zh");

    let mood_translation_map = get_dict_translation_map(
        &state,
        "note.mood",
        lang,
        &note.mood.iter().cloned().collect::<Vec<_>>(),
    )
    .await;
    let weather_translation_map = get_dict_translation_map(
        &state,
        "note.weather",
        lang,
        &note.weather.iter().cloned().collect::<Vec<_>>(),
    )
    .await;
    localize_note_taxonomy_fields(
        std::iter::once(&mut note),
        &mood_translation_map,
        &weather_translation_map,
    );

    note.ai_summary = get_ai_summary(&state, &note_id, lang).await;
    if let Some(translation) = get_ai_translation(&state, &note_id, "notes", lang).await {
        apply_translation_to_note(&mut note, &translation);
    }
    if is_protected_note(&note) {
        return Err(AppError::Forbidden);
    }
    strip_protected_fields(&mut note);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: note,
    }))
}

/// Unlock protected note by numeric ID (nid)
pub async fn unlock_note_by_nid(
    State(state): State<SharedState>,
    Path(nid): Path<i32>,
    AppJson(request): AppJson<UnlockNoteRequest>,
) -> AppResult<Json<ApiResponse<Note>>> {
    let collection = state.db.collection::<Note>("notes");
    let mut note = collection
        .find_one(doc! { "nid": nid, "isPublished": true })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Note not found".to_string()))?;

    let stored_password = note.password.as_deref().unwrap_or("");
    if stored_password.is_empty() || stored_password != request.password {
        return Err(AppError::Forbidden);
    }

    let note_id = note.id.to_hex();
    let lang = request.lang.as_deref().unwrap_or("zh");

    let mood_translation_map = get_dict_translation_map(
        &state,
        "note.mood",
        lang,
        &note.mood.iter().cloned().collect::<Vec<_>>(),
    )
    .await;
    let weather_translation_map = get_dict_translation_map(
        &state,
        "note.weather",
        lang,
        &note.weather.iter().cloned().collect::<Vec<_>>(),
    )
    .await;
    localize_note_taxonomy_fields(
        std::iter::once(&mut note),
        &mood_translation_map,
        &weather_translation_map,
    );

    note.ai_summary = get_ai_summary(&state, &note_id, lang).await;
    if let Some(translation) = get_ai_translation(&state, &note_id, "notes", lang).await {
        apply_translation_to_note(&mut note, &translation);
    }
    strip_protected_fields(&mut note);
    note.is_encrypted = false;

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
    AppQuery(params): AppQuery<DetailNoteParams>,
) -> AppResult<Json<ApiResponse<AdjacentNotes>>> {
    let collection = state.db.collection::<MinimalNote>("notes");
    let lang = params.lang.as_deref().unwrap_or("zh");

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
        prev: match prev_note {
            Some(note) => {
                let title = if let Some(translation) =
                    get_ai_translation(&state, &note.id.to_hex(), "notes", lang).await
                {
                    translation.title.unwrap_or(note.title)
                } else {
                    note.title
                };
                Some(AdjacentNote {
                    nid: note.nid,
                    title,
                })
            }
            None => None,
        },
        next: match next_note {
            Some(note) => {
                let title = if let Some(translation) =
                    get_ai_translation(&state, &note.id.to_hex(), "notes", lang).await
                {
                    translation.title.unwrap_or(note.title)
                } else {
                    note.title
                };
                Some(AdjacentNote {
                    nid: note.nid,
                    title,
                })
            }
            None => None,
        },
    };

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: adjacent,
    }))
}
