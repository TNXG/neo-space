//! Admin user management handlers (owner-only operations)

use crate::{
    app::SharedState,
    auth::extractors::OwnerOnly,
    error::{AppError, AppQuery, AppResult},
    models::*,
};
use axum::{
    Json,
    extract::{Path, State},
};
use bson::{doc, oid::ObjectId};
use futures::stream::TryStreamExt;
use serde::Deserialize;

/// Query parameters for listing users
#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    page: Option<u64>,
    size: Option<u64>,
}

/// List all readers (admin only)
pub async fn list_users(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    AppQuery(params): AppQuery<ListUsersQuery>,
) -> AppResult<Json<ApiResponse<PaginatedData<ReaderResponse>>>> {
    let page = params.page.unwrap_or(1).max(1);
    let size = params.size.unwrap_or(10).clamp(1, 100);
    let skip = (page - 1) * size;

    let collection = state.db.collection::<Reader>("readers");
    let filter = doc! {};

    // Get total count
    let total = collection
        .count_documents(filter.clone())
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    // Fetch readers with pagination
    let find_options = mongodb::options::FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .skip(skip)
        .limit(size as i64)
        .build();

    let mut cursor = collection
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut readers = Vec::new();
    while let Some(reader) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        readers.push(ReaderResponse::from(reader));
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
        data: PaginatedData {
            items: readers,
            pagination,
        },
    }))
}

/// Get a single reader by ID (admin only)
pub async fn get_user_by_id(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Reader>("readers");
    let reader = collection
        .find_one(doc! { "_id": object_id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: ReaderResponse::from(reader),
    }))
}

/// Get a single reader by email (admin only)
pub async fn get_user_by_email(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(email): Path<String>,
) -> AppResult<Json<ApiResponse<ReaderResponse>>> {
    let collection = state.db.collection::<Reader>("readers");
    let reader = collection
        .find_one(doc! { "email": &email })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: ReaderResponse::from(reader),
    }))
}

/// Delete a reader by ID (admin only)
pub async fn delete_user(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<()>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    let collection = state.db.collection::<Reader>("readers");

    // Check if user exists
    let reader = collection
        .find_one(doc! { "_id": object_id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    // Prevent deleting owner account
    if reader.is_owner {
        return Err(AppError::BadRequest(
            "Cannot delete owner account".to_string(),
        ));
    }

    // Delete reader
    collection
        .delete_one(doc! { "_id": object_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to delete user: {}", e)))?;

    // Also delete associated accounts
    let accounts_collection = state.db.collection::<Account>("accounts");
    accounts_collection
        .delete_many(doc! { "userId": object_id })
        .await
        .map_err(|e| AppError::Database(format!("Failed to delete user accounts: {}", e)))?;

    tracing::info!("User {} deleted", id);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "User deleted successfully".to_string(),
        data: (),
    }))
}

/// List all accounts for a user (admin only)
pub async fn list_user_accounts(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path(id): Path<String>,
) -> AppResult<Json<ApiResponse<Vec<AccountResponse>>>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| AppError::BadRequest("Invalid ID format".to_string()))?;

    // Verify user exists
    let readers_collection = state.db.collection::<Reader>("readers");
    readers_collection
        .find_one(doc! { "_id": object_id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    // Fetch accounts
    let accounts_collection = state.db.collection::<Account>("accounts");
    let mut cursor = accounts_collection
        .find(doc! { "userId": object_id })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?;

    let mut accounts = Vec::new();
    while let Some(account) = cursor
        .try_next()
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
    {
        accounts.push(AccountResponse::from(account));
    }

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Success".to_string(),
        data: accounts,
    }))
}

/// Delete a specific account (admin only)
pub async fn delete_user_account(
    State(state): State<SharedState>,
    _owner: OwnerOnly,
    Path((user_id, account_id)): Path<(String, String)>,
) -> AppResult<Json<ApiResponse<()>>> {
    let user_oid = ObjectId::parse_str(&user_id)
        .map_err(|_| AppError::BadRequest("Invalid user ID format".to_string()))?;
    let account_oid = ObjectId::parse_str(&account_id)
        .map_err(|_| AppError::BadRequest("Invalid account ID format".to_string()))?;

    let collection = state.db.collection::<Account>("accounts");

    // Verify account exists and belongs to user
    let _account = collection
        .find_one(doc! { "_id": account_oid, "userId": user_oid })
        .await
        .map_err(|e| AppError::Database(e.to_string()))?
        .ok_or(AppError::NotFound("Account not found".to_string()))?;

    // Delete account
    collection
        .delete_one(doc! { "_id": account_oid })
        .await
        .map_err(|e| AppError::Database(format!("Failed to delete account: {}", e)))?;

    tracing::info!("Account {} for user {} deleted", account_id, user_id);

    Ok(Json(ApiResponse {
        code: 200,
        status: ResponseStatus::Success,
        message: "Account deleted successfully".to_string(),
        data: (),
    }))
}
