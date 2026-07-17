//! User management handlers (public and authenticated user operations)

use crate::{
    app::SharedState,
    auth::extractors::AuthUser,
    error::{AppError, AppJson, AppQuery, AppResult},
    models::*,
};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::{Deserialize, Serialize};

/// Query parameters for pagination (public endpoints)
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub page: Option<u64>,
    pub size: Option<u64>,
}

/// Update user profile request
#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    name: Option<String>,
    #[serde(alias = "username")]
    handle: Option<String>,
    #[serde(alias = "avatar")]
    image: Option<String>,
    #[serde(alias = "mail")]
    email: Option<String>,
    introduce: Option<String>,
    url: Option<String>,
    #[serde(rename = "socialIds")]
    social_ids: Option<UserSocialIds>,
}

/// Update avatar request
#[derive(Debug, Deserialize)]
pub struct UpdateAvatarRequest {
    email: String,
}

/// Avatar response
#[derive(Debug, Serialize)]
pub struct AvatarResponse {
    avatar: String,
}

/// Update reader profile (authenticated users can update their own profile)
pub async fn update_user_profile(
    State(state): State<SharedState>,
    auth_user: AuthUser,
    AppJson(payload): AppJson<UpdateProfileRequest>,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    let readers = state.db.collection::<Reader>("readers");
    let owner_profiles = state.db.collection::<bson::Document>("owner_profiles");

    let mut reader_update = doc! {};
    let mut owner_update = doc! {};

    if let Some(name) = payload.name
        && !name.is_empty()
    {
        reader_update.insert("name", name);
    }

    if let Some(handle) = payload.handle
        && !handle.is_empty()
    {
        if !handle
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            return Err(AppError::BadRequest("Invalid handle format. Only alphanumeric characters, dashes, and underscores are allowed.".to_string()));
        }
        let occupied = readers
            .find_one(doc! { "handle": &handle, "_id": { "$ne": auth_user.user_id } })
            .await
            .map_err(|e| AppError::Database(e.to_string()))?
            .is_some();
        if occupied {
            return Err(AppError::BadRequest(
                "Username is already in use".to_string(),
            ));
        }
        reader_update.insert("handle", handle);
    }

    if let Some(image) = payload.image {
        reader_update.insert("image", image);
    }

    if let Some(email) = payload.email {
        let email = email.trim().to_lowercase();
        if !email.contains('@') {
            return Err(AppError::BadRequest("Invalid email address".to_string()));
        }
        reader_update.insert("email", &email);
        owner_update.insert("mail", email);
    }
    if let Some(introduce) = payload.introduce {
        owner_update.insert("introduce", introduce);
    }
    if let Some(url) = payload.url {
        owner_update.insert("url", url);
    }
    if let Some(social_ids) = payload.social_ids {
        owner_update.insert(
            "socialIds",
            bson::to_bson(&social_ids)
                .map_err(|e| AppError::Internal(format!("Failed to encode social IDs: {e}")))?,
        );
    }

    if reader_update.is_empty() && owner_update.is_empty() {
        return Err(AppError::BadRequest("No fields to update".to_string()));
    }

    if !reader_update.is_empty() {
        reader_update.insert("updatedAt", bson::DateTime::now());
        readers
            .update_one(
                doc! { "_id": auth_user.user_id },
                doc! { "$set": reader_update },
            )
            .await
            .map_err(|e| AppError::Database(format!("Failed to update profile: {e}")))?;
    }
    if !owner_update.is_empty() {
        owner_profiles
            .update_one(
                doc! { "readerId": auth_user.user_id },
                doc! { "$set": owner_update },
            )
            .await
            .map_err(|e| AppError::Database(format!("Failed to update owner profile: {e}")))?;
    }

    // Fetch updated reader
    let updated_reader = readers
        .find_one(doc! { "_id": auth_user.user_id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::Internal(
            "Failed to fetch updated profile".to_string(),
        ))?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Profile updated successfully".to_string(),
        data: ReaderResponse::from(updated_reader),
    }))
}

/// Update user avatar (gravatar/cravatar based on email)
pub async fn update_avatar(
    State(_state): State<SharedState>,
    AppJson(payload): AppJson<UpdateAvatarRequest>,
) -> AppResult<Json<ApiResponse<AvatarResponse>>> {
    // Generate Gravatar/Cravatar URL from email
    let email = payload.email.trim().to_lowercase();
    let hash = format!("{:x}", md5::compute(email.as_bytes()));
    let avatar_url = format!("https://cravatar.cn/avatar/{hash}");

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Avatar generated successfully".to_string(),
        data: AvatarResponse { avatar: avatar_url },
    }))
}

/// Check if a handle is available
#[derive(Debug, Deserialize)]
pub struct CheckHandleQuery {
    handle: String,
}

#[derive(Debug, Serialize)]
pub struct HandleAvailabilityResponse {
    available: bool,
}

pub async fn check_handle_availability(
    State(state): State<SharedState>,
    AppQuery(query): AppQuery<CheckHandleQuery>,
) -> AppResult<Json<ApiResponse<HandleAvailabilityResponse>>> {
    let collection = state.db.collection::<Reader>("readers");

    let exists = collection
        .find_one(doc! { "handle": &query.handle })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .is_some();

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: HandleAvailabilityResponse { available: !exists },
    }))
}

/// Get the blog owner's public profile (joins owner_profiles + readers via readerId)
pub async fn get_owner_profile(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<User>>> {
    let owner_collection = state.db.collection::<bson::Document>("owner_profiles");

    // Same aggregation pipeline as the Rocket backend
    let pipeline = vec![
        doc! {
            "$lookup": {
                "from": "readers",
                "localField": "readerId",
                "foreignField": "_id",
                "as": "reader"
            }
        },
        doc! { "$unwind": "$reader" },
        doc! {
            "$project": {
                "_id": 1,
                "introduce": 1,
                "mail": 1,
                "url": 1,
                "created": 1,
                "lastLoginTime": 1,
                "socialIds": 1,
                "reader.handle": 1,
                "reader.email": 1,
                "reader.name": 1,
                "reader.image": 1,
            }
        },
        doc! { "$limit": 1 },
    ];

    let mut cursor = owner_collection
        .aggregate(pipeline)
        .await
        .map_err(|e| AppError::Database(format!("Aggregation failed: {}", e)))?;

    let doc = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(format!("Failed to read profile: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Owner profile not found".to_string()))?;

    let owner_id = doc
        .get_object_id("_id")
        .map_err(|_| AppError::Internal("Missing _id in owner_profiles".to_string()))?;

    let reader_doc = doc
        .get_document("reader")
        .map_err(|_| AppError::Internal("Missing reader in aggregation result".to_string()))?;

    let social_ids = doc
        .get_document("socialIds")
        .ok()
        .and_then(|d| bson::from_document::<UserSocialIds>(d.clone()).ok());

    let user = User {
        id: owner_id,
        username: reader_doc.get_str("handle").unwrap_or_default().to_string(),
        name: reader_doc.get_str("name").unwrap_or_default().to_string(),
        introduce: doc.get_str("introduce").unwrap_or_default().to_string(),
        avatar: reader_doc.get_str("image").unwrap_or_default().to_string(),
        mail: reader_doc
            .get_str("email")
            .or_else(|_| doc.get_str("mail"))
            .unwrap_or_default()
            .to_string(),
        url: doc.get_str("url").unwrap_or_default().to_string(),
        created: doc
            .get_datetime("created")
            .cloned()
            .unwrap_or_else(|_| bson::DateTime::now()),
        last_login_time: doc
            .get_datetime("lastLoginTime")
            .cloned()
            .unwrap_or_else(|_| bson::DateTime::now()),
        social_ids,
    };

    Ok(Json(ApiResponse::success(user)))
}

/// Get all readers (public endpoint, no auth required)
pub async fn list_readers_public(
    State(state): State<SharedState>,
) -> AppResult<Json<ApiResponse<Vec<ReaderResponse>>>> {
    let collection = state.db.collection::<Reader>("readers");

    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .projection(doc! {
            "email": 0,  // Hide email for public list endpoint
        })
        .build();

    let mut cursor = collection
        .find(doc! {})
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Database(format!("Failed to find readers: {}", e)))?;

    let mut items = Vec::new();
    while let Some(reader) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(format!("Failed to iterate readers: {}", e)))?
    {
        let mut response = ReaderResponse::from(reader);
        response.email = String::new(); // Always hide email in list
        items.push(response);
    }

    Ok(Json(ApiResponse::success(items)))
}

/// Get a single reader by ID (public endpoint, returns actual email)
pub async fn get_reader_by_id_public(
    State(state): State<SharedState>,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Reader>("readers");
    let reader = collection
        .find_one(doc! { "_id": object_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to find reader: {}", e)))?
        .ok_or_else(|| AppError::NotFound("Reader not found".to_string()))?;

    let response = ReaderResponse::from(reader); // email included

    Ok(Json(ApiResponse::success(response)))
}
