//! API response structures

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
    pub fn success(data: T) -> Self {
        Self {
            code: 200,
            status: ResponseStatus::Success,
            message: "Success".to_string(),
            data,
        }
    }

    #[allow(unused)]
    pub fn error(code: u16, message: String) -> ApiResponse<()> {
        ApiResponse {
            code,
            status: ResponseStatus::Failed,
            message,
            data: (),
        }
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
