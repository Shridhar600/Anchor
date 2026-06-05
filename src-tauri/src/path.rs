use directories::ProjectDirs;
use std::path::PathBuf;

const APP_DIR: &str = "Anchor";

pub fn resolve_db_path() -> String {
    if let Ok(p) = std::env::var("ANCHOR_DB") {
        if !p.is_empty() {
            return p;
        }
    }
    match ProjectDirs::from("", "", APP_DIR) {
        Some(d) => d
            .data_dir()
            .join("anchor.db")
            .to_string_lossy()
            .into_owned(),
        None => "anchor.db".to_string(),
    }
}

pub fn ensure_parent_dir(path: &str) -> std::io::Result<()> {
    let parent: PathBuf = PathBuf::from(path)
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .map(PathBuf::from)
        .unwrap_or_default();
    if !parent.as_os_str().is_empty() {
        std::fs::create_dir_all(&parent)?;
    }
    Ok(())
}
