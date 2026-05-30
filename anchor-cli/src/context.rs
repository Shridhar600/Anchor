use crate::error::CliError;
use anchor_core::db::Db;

pub struct Context {
    pub db: Db,
    pub actor: String,
    pub json: bool,
}

impl Context {
    pub fn new(
        db_override: Option<String>,
        actor_override: Option<String>,
        json: bool,
    ) -> Result<Context, CliError> {
        let path = resolve_db_path(db_override);
        if let Some(parent) = std::path::Path::new(&path).parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)?;
            }
        }
        let db = Db::open(&path)?;
        let actor = actor_override
            .or_else(|| std::env::var("ANCHOR_ACTOR").ok())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "cli".to_string());
        Ok(Context { db, actor, json })
    }
}

fn resolve_db_path(db_override: Option<String>) -> String {
    if let Some(p) = db_override {
        return p;
    }
    if let Ok(p) = std::env::var("ANCHOR_DB") {
        if !p.is_empty() {
            return p;
        }
    }
    match directories::ProjectDirs::from("", "", "Anchor") {
        Some(d) => d
            .data_dir()
            .join("anchor.db")
            .to_string_lossy()
            .into_owned(),
        None => "anchor.db".to_string(),
    }
}
