//! Link (Friend) handlers

use crate::{
    app::SharedState,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::Deserialize;

/// List links query parameters
#[derive(Debug, Deserialize)]
pub struct ListLinksParams {
    page: Option<u64>,
    size: Option<u64>,
}

/// Send verification code to email
pub async fn send_verification_code(
    State(state): State<SharedState>,
    AppJson(payload): AppJson<SendCodeRequest>,
) -> AppResult<Json<ApiResponse<String>>> {
    let email_service = &state.email_service;

    // Check if email already has a valid code (rate limiting)
    if email_service.has_code(&payload.email).await {
        return Err(AppError::BadRequest(
            "Verification code already sent, please wait".to_string(),
        ));
    }

    // Get site name for email
    let site_name = get_site_name(&state)
        .await
        .unwrap_or_else(|| "Neo Space".to_string());

    // Send verification code email
    email_service
        .send_verification_code_email(&payload.email, &site_name)
        .await?;

    tracing::info!("Verification code sent to: {}", payload.email);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Verification code sent".to_string(),
        data: "Verification code sent".to_string(),
    }))
}

/// List approved friend links with pagination
pub async fn list_links(
    State(state): State<SharedState>,
    AppQuery(params): AppQuery<ListLinksParams>,
) -> AppResult<Json<ApiResponse<PaginatedData<LinkWithHealth>>>> {
    let page = params.page.unwrap_or(1).max(1);
    let size = params.size.unwrap_or(50).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = state.db.collection::<Link>("links");

    // Only return links with normal state
    let filter = doc! {
        "$or": [
            { "state": LinkState::NORMAL },
            { "state": { "$exists": false } }
        ]
    };

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "created": -1 })
        .skip(skip)
        .limit(size as i64)
        .build();

    // Get total count
    let total = collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| AppError::Database(format!("Failed to count links: {}", e)))?;

    // Fetch links
    let mut cursor = collection
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Database(format!("Failed to find links: {}", e)))?;

    let mut links = Vec::new();
    while let Some(link) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(format!("Failed to deserialize link: {}", e)))?
    {
        links.push(link);
    }

    // Wrap in LinkWithHealth and enrich with health data from cache
    let mut items = Vec::new();
    for link in links {
        let cache_key = format!("link_health_{}", link.id.to_hex());
        // Try to get from cache - returns None if not cached yet
        let health = state
            .cache
            .get(&cache_key)
            .await
            .and_then(|bytes| serde_json::from_slice::<LinkHealthStatus>(&bytes).ok());
        items.push(LinkWithHealth { link, health });
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

/// Get link by ID
pub async fn get_link(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<Link>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Link>("links");

    let link = collection
        .find_one(doc! { "_id": object_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to find link: {}", e)))?
        .ok_or(AppError::NotFound("Link not found".to_string()))?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: link,
    }))
}

/// Apply for a friend link
pub async fn apply_link(
    State(state): State<SharedState>,
    AppJson(payload): AppJson<LinkApplyRequest>,
) -> AppResult<Json<ApiResponse<Link>>> {
    let email_service = &state.email_service;

    // 1. Verify the verification code
    email_service
        .verify_code(&payload.email, &payload.code)
        .await
        .inspect_err(|_e| {
            tracing::warn!("Verification code validation failed");
        })?;

    let collection = state.db.collection::<Link>("links");

    // 2. Check if URL already exists
    let existing = collection
        .find_one(doc! { "url": &payload.url })
        .await
        .map_err(|e| AppError::Database(format!("Failed to check existing link: {}", e)))?;

    if existing.is_some() {
        return Err(AppError::BadRequest("URL already exists".to_string()));
    }

    // 3. Create new friend link with PENDING state
    let new_link = Link {
        id: ObjectId::new(),
        name: payload.name.clone(),
        url: payload.url.clone(),
        avatar: payload.avatar.clone(),
        description: payload.description.clone(),
        state: LinkState::PENDING,
        r#type: LinkType::FRIEND,
        created: bson::DateTime::now(),
        email: Some(payload.email.clone()),
        rssurl: payload.rssurl.clone(),
        techstack: payload.techstack.clone(),
    };

    collection
        .insert_one(&new_link)
        .await
        .map_err(|e| AppError::Database(format!("Failed to create link: {}", e)))?;

    tracing::info!("New friend link application from: {}", payload.email);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Link application submitted successfully".to_string(),
        data: new_link,
    }))
}

/// Helper function to get site name from database
async fn get_site_name(state: &SharedState) -> Option<String> {
    use bson::Document;

    let collection: mongodb::Collection<Document> = state.db.collection("options");

    let option = collection
        .find_one(doc! { "name": "siteConfig" })
        .await
        .ok()??;

    let value = option.get_document("value").ok()?;
    let seo = value.get_document("seo").ok()?;
    let title = seo.get_str("title").ok()?;

    if title.is_empty() {
        None
    } else {
        Some(title.to_string())
    }
}
