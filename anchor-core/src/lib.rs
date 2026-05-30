//! Anchor — local-first dev project & thread tracker (data layer).
//! SQLite-backed storage for projects, threads, notes, resources, and an audit log.

pub mod db;
pub mod error;
pub mod migrations;
pub mod models;
pub mod repository;

pub use error::{AnchorError, Result};
