//! Miscellaneous handlers

pub mod cargo;
pub mod external;
pub mod pagination;
pub mod site;

// Re-export for convenience
pub use cargo::{get_crate_info, get_crate_info_with_version};
pub use external::{aggregate_nav, nbnhhsh_guess};
pub use site::{get_config, list_recentlies};
