//! Anchor desktop app — Tauri v2 backend (command layer over anchor-core).

pub mod commands;
pub mod dto;
pub mod error;
pub mod mapping;
mod path;
mod state;

pub use error::ApiError;

use crate::state::AppState;
use anchor_core::db::Db;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let db_path = path::resolve_db_path();
            path::ensure_parent_dir(&db_path)
                .map_err(|e| format!("failed to create db parent dir for {db_path}: {e}"))?;
            let db =
                Db::open(&db_path).map_err(|e| format!("failed to open db at {db_path}: {e}"))?;
            let state = AppState {
                db: Mutex::new(db.conn),
                db_path,
            };
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_projects,
            commands::get_project,
            commands::create_project,
            commands::update_project,
            commands::set_project_status,
            commands::list_threads,
            commands::get_thread,
            commands::create_thread,
            commands::update_thread,
            commands::move_thread,
            commands::delete_thread,
            commands::append_note,
            commands::add_resource,
            commands::delete_resource,
            commands::get_settings,
            commands::set_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
