//! Miscellaneous handlers

pub mod pagination;
pub mod site;
pub mod external;

// Re-export for convenience
pub use pagination::PaginationParams;
pub use site::{get_config, list_categories, list_recentlies};
pub use external::{nbnhhsh_guess, aggregate_nav};
