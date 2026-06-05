use rusqlite::Connection;
use std::sync::Mutex;

/// State held by Tauri across the app's lifetime. The DB is opened once at
/// startup and a `Mutex` serializes command access (SQLite itself is also
/// serialized via the WAL busy_timeout, but the Mutex keeps types simple).
pub struct AppState {
    pub db: Mutex<Connection>,
    pub db_path: String,
}
