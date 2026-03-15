//! Real-time features

pub mod common;
pub mod owner_desktop;
pub mod reader;

pub use owner_desktop::owner_desktop_ws;
pub use reader::reader_ws;
