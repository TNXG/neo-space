//! Change Stream service - `MongoDB` Change Stream listener with auto-reconnect

pub(crate) mod handlers;
pub(crate) mod service;

pub use service::ChangeStreamService;
