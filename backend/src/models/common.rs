//! Common data structures for API responses

use serde::{Deserialize, Serialize};

/// Standard API response wrapper
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct ApiResponse<T> {
    /// HTTP status code
    pub code: u16,
    /// Response status
    pub status: ResponseStatus,
    /// Response message
    pub message: String,
    /// Response data
    pub data: T,
}

/// Response status enum
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
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
}

/// Pagination metadata
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Pagination {
    /// Total number of records
    pub total: i64,
    /// Current page number
    pub current_page: i64,
    /// Total number of pages
    pub total_page: i64,
    /// Number of items per page
    pub size: i64,
    /// Whether there is a next page
    pub has_next_page: bool,
    /// Whether there is a previous page
    pub has_prev_page: bool,
}

impl Pagination {
    /// Create pagination metadata
    pub fn new(total: i64, current_page: i64, size: i64) -> Self {
        let total_page = if total > 0 && size > 0 {
            (total as f64 / size as f64).ceil() as i64
        } else {
            0
        };

        Self {
            total,
            current_page,
            total_page,
            size,
            has_next_page: current_page < total_page,
            has_prev_page: current_page > 1,
        }
    }
}

/// Paginated response wrapper (alias for PaginatedData)
pub type PaginatedList<T> = PaginatedData<T>;

/// Paginated response wrapper
#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PaginatedData<T> {
    /// List of items
    pub items: Vec<T>,
    /// Pagination metadata
    pub pagination: Pagination,
}
