//! Draft history routes（owner-only）

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppResult},
    models::serializers::serialize_datetime,
    models::*,
};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, doc, oid::ObjectId};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DraftHistoryListItem {
    pub version: i32,
    pub title: String,
    #[serde(rename = "savedAt", serialize_with = "serialize_datetime")]
    pub saved_at: bson::DateTime,
    #[serde(rename = "isFullSnapshot")]
    pub is_full_snapshot: bool,
    #[serde(rename = "refVersion", skip_serializing_if = "Option::is_none")]
    pub ref_version: Option<i32>,
    #[serde(rename = "baseVersion", skip_serializing_if = "Option::is_none")]
    pub base_version: Option<i32>,
}

fn parse_oid(id: &str) -> AppResult<ObjectId> {
    ObjectId::parse_str(id).map_err(|_| AppError::BadRequest("Invalid ObjectId".to_string()))
}

fn draft_saved_at(draft: &Draft) -> bson::DateTime {
    draft.updated.or(draft.modified).unwrap_or(draft.created)
}

fn current_history_item(draft: &Draft) -> DraftHistoryListItem {
    DraftHistoryListItem {
        version: draft.version.max(1),
        title: draft.title.clone().unwrap_or_default(),
        saved_at: draft_saved_at(draft),
        is_full_snapshot: true,
        ref_version: None,
        base_version: None,
    }
}

fn history_item(entry: &DraftHistoryEntry) -> DraftHistoryListItem {
    DraftHistoryListItem {
        version: entry.version,
        title: entry.title.clone(),
        saved_at: entry.saved_at,
        is_full_snapshot: entry.is_full_snapshot,
        ref_version: entry.ref_version,
        base_version: entry.base_version,
    }
}

fn draft_snapshot(draft: &Draft) -> bson::Document {
    let mut snapshot = doc! {
        "version": draft.version.max(1),
        "title": draft.title.clone().unwrap_or_default(),
        "text": draft.text.clone().unwrap_or_default(),
        "contentFormat": draft
            .content_format
            .clone()
            .unwrap_or_else(|| "markdown".to_string()),
        "savedAt": draft_saved_at(draft),
        "isFullSnapshot": true,
    };

    if let Some(content) = draft.content.clone() {
        snapshot.insert("content", content);
    }
    if let Some(type_specific_data) = draft.type_specific_data.clone() {
        snapshot.insert("typeSpecificData", type_specific_data);
    }

    snapshot
}

fn decode_patch_segment(segment: &str) -> String {
    urlencoding::decode(segment)
        .map(|decoded| decoded.into_owned())
        .unwrap_or_else(|_| segment.to_string())
}

fn apply_dmp_patch(source: &str, patch: &str) -> String {
    if !patch.starts_with("@@") {
        return patch.to_string();
    }

    let mut result = source.to_string();
    let mut old_chunk = String::new();
    let mut new_chunk = String::new();

    for line in patch.lines() {
        if line.starts_with("@@") {
            if !old_chunk.is_empty() || !new_chunk.is_empty() {
                result = result.replacen(&old_chunk, &new_chunk, 1);
                old_chunk.clear();
                new_chunk.clear();
            }
            continue;
        }

        if line.is_empty() {
            continue;
        }
        let (op, encoded) = line.split_at(1);
        let decoded = decode_patch_segment(encoded);
        match op {
            " " => {
                old_chunk.push_str(&decoded);
                new_chunk.push_str(&decoded);
            }
            "-" => old_chunk.push_str(&decoded),
            "+" => new_chunk.push_str(&decoded),
            _ => {}
        }
    }

    if !old_chunk.is_empty() || !new_chunk.is_empty() {
        result = result.replacen(&old_chunk, &new_chunk, 1);
    }

    result
}

fn resolve_history_text(draft: &Draft, entry: &DraftHistoryEntry) -> String {
    if entry.is_full_snapshot {
        return entry.text.clone();
    }

    let Some(base_version) = entry.base_version else {
        return entry.text.clone();
    };
    let Some(base) = draft
        .history
        .iter()
        .find(|item| item.version == base_version && item.is_full_snapshot)
    else {
        return entry.text.clone();
    };

    let mut text = base.text.clone();
    let mut patches: Vec<&DraftHistoryEntry> = draft
        .history
        .iter()
        .filter(|item| item.version > base_version && item.version <= entry.version)
        .collect();
    patches.sort_by_key(|item| item.version);

    for patch_entry in patches {
        if patch_entry.is_full_snapshot {
            text = patch_entry.text.clone();
        } else {
            text = apply_dmp_patch(&text, &patch_entry.text);
        }
    }

    text
}

fn apply_history_entry(mut draft: Draft, entry: &DraftHistoryEntry) -> Draft {
    draft.version = entry.version;
    draft.title = Some(entry.title.clone());
    draft.text = Some(resolve_history_text(&draft, entry));
    draft.content_format = entry.content_format.clone();
    draft.content = entry.content.clone();
    draft.type_specific_data = entry.type_specific_data.clone();
    draft.updated = Some(entry.saved_at);
    draft.modified = Some(entry.saved_at);
    draft
}

async fn load_draft(state: &SharedState, id: &str) -> AppResult<Draft> {
    let oid = parse_oid(id)?;
    state
        .db
        .collection::<Draft>("drafts")
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Draft not found".into()))
}

pub async fn list_draft_history(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<Vec<DraftHistoryListItem>>>> {
    let draft = load_draft(&state, &id).await?;
    let mut items = Vec::with_capacity(draft.history.len() + 1);
    items.push(current_history_item(&draft));
    items.extend(draft.history.iter().map(history_item));
    items.sort_by_key(|item| std::cmp::Reverse(item.version));

    Ok(Json(ApiResponse::success(items)))
}

pub async fn get_draft_history_version(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path((id, version)): Path<(String, i32)>,
) -> AppResult<Json<ApiResponse<Draft>>> {
    let draft = load_draft(&state, &id).await?;
    if version == draft.version {
        return Ok(Json(ApiResponse::success(draft)));
    }

    let entry = draft
        .history
        .iter()
        .find(|item| item.version == version)
        .cloned()
        .ok_or(AppError::NotFound("Draft history version not found".into()))?;

    Ok(Json(ApiResponse::success(apply_history_entry(
        draft, &entry,
    ))))
}

pub async fn restore_draft_version(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path((id, version)): Path<(String, i32)>,
) -> AppResult<Json<ApiResponse<Draft>>> {
    let oid = parse_oid(&id)?;
    let current = load_draft(&state, &id).await?;
    if version == current.version {
        return Ok(Json(ApiResponse::success(current)));
    }

    let entry = current
        .history
        .iter()
        .find(|item| item.version == version)
        .ok_or(AppError::NotFound("Draft history version not found".into()))?;
    let restored = apply_history_entry(current.clone(), entry);
    let now = bson::DateTime::now();
    let mut set_doc = doc! {
        "title": restored.title.unwrap_or_default(),
        "text": restored.text.unwrap_or_default(),
        "contentFormat": restored.content_format.unwrap_or_else(|| "markdown".to_string()),
        "updated": now,
        "modified": now,
        "version": current.version.max(1) + 1,
    };

    match restored.content {
        Some(content) => {
            set_doc.insert("content", content);
        }
        None => {
            set_doc.insert("content", Bson::Null);
        }
    }
    match restored.type_specific_data {
        Some(type_specific_data) => {
            set_doc.insert("typeSpecificData", type_specific_data);
        }
        None => {
            set_doc.insert("typeSpecificData", Bson::Null);
        }
    }

    let collection = state.db.collection::<Draft>("drafts");
    collection
        .update_one(
            doc! { "_id": oid },
            doc! {
                "$set": set_doc,
                "$push": { "history": draft_snapshot(&current) },
            },
        )
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let draft = collection
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Draft not found".into()))?;

    Ok(Json(ApiResponse::success(draft)))
}
