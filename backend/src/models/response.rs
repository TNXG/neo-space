//! API response structures

use rocket::serde::json::Json;
use serde::{Deserialize, Serialize};

/// Standard API response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub code: u16,
    pub status: ResponseStatus,
    pub message: String,
    pub data: T,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResponseStatus {
    Success,
    Failed,
}

impl<T> ApiResponse<T> {
    /// Create a successful response with data
    pub fn success(data: T) -> Self {
        Self {
            code: 200,
            status: ResponseStatus::Success,
            message: "Success".to_string(),
            data,
        }
    }

    /// Create a successful response with custom message
    pub fn success_with_message(data: T, message: String) -> Self {
        Self {
            code: 200,
            status: ResponseStatus::Success,
            message,
            data,
        }
    }

    /// Create an error response with empty data
    pub fn error(code: u16, message: String) -> ApiResponse<()> {
        ApiResponse {
            code,
            status: ResponseStatus::Failed,
            message,
            data: (),
        }
    }
}

/// Auth-specific response helpers
impl<T> ApiResponse<T> {
    /// Create a JSON success response
    pub fn json_success(data: T) -> Json<Self> {
        Json(Self::success(data))
    }

    /// Create a JSON success response with custom message
    pub fn json_success_with_message(data: T, message: String) -> Json<Self> {
        Json(Self::success_with_message(data, message))
    }

    /// Create a JSON error response with default data
    pub fn json_error_with_default(code: u16, message: String) -> Json<Self>
    where
        T: Default,
    {
        Json(ApiResponse {
            code,
            status: ResponseStatus::Failed,
            message,
            data: T::default(),
        })
    }
}

impl ApiResponse<()> {
    /// Create a JSON error response
    #[allow(unused)]
    pub fn json_error(code: u16, message: String) -> Json<Self> {
        Json(Self::error(code, message))
    }

    /// Common auth error responses
    #[allow(unused)]
    pub fn unauthorized(message: String) -> Json<Self> {
        Json(Self::error(401, message))
    }

    #[allow(unused)]
    pub fn forbidden(message: String) -> Json<Self> {
        Json(Self::error(403, message))
    }

    pub fn not_found(message: String) -> Json<Self> {
        Json(Self::error(404, message))
    }

    pub fn bad_request(message: String) -> Json<Self> {
        Json(Self::error(400, message))
    }

    pub fn internal_error(message: String) -> Json<Self> {
        Json(Self::error(500, message))
    }
}

/// Pagination metadata
#[derive(Debug, Serialize, Deserialize)]
pub struct Pagination {
    pub total: i64,
    pub current_page: i64,
    pub total_page: i64,
    pub size: i64,
    pub has_next_page: bool,
    pub has_prev_page: bool,
}

/// Paginated response wrapper
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedData<T> {
    pub items: Vec<T>,
    pub pagination: Pagination,
}

pub type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;
