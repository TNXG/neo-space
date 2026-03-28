//! Miscellaneous handlers

pub mod external;
pub mod pagination;
pub mod site;

// Re-export for convenience
pub use external::{aggregate_nav, nbnhhsh_guess};
pub use site::{get_config, list_categories, list_recentlies};
