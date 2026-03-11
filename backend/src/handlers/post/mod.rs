//! Post handlers

mod adjacent;
mod detail;
mod enrich;
mod list;

pub use adjacent::get_adjacent_posts;
pub use detail::{get_post, get_post_by_slug};
pub use list::list_posts;

// Re-export types needed by other modules
