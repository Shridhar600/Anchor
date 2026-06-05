use anchor_core::AnchorError;
use serde::Serialize;

/// Tauri commands return `Result<T, ApiError>`. Tauri serializes errors to
/// JSON for the frontend; this wrapper exists so we get a clean
/// `{ "message": "..." }` shape instead of `thiserror`'s default `Debug` blob.
#[derive(Debug)]
pub struct ApiError(pub AnchorError);

impl From<AnchorError> for ApiError {
    fn from(e: AnchorError) -> Self {
        ApiError(e)
    }
}

impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        ApiError(AnchorError::Db(e))
    }
}

impl serde::Serialize for ApiError {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> std::result::Result<S::Ok, S::Error> {
        #[derive(Serialize)]
        struct Out<'a> {
            message: String,
            kind: &'a str,
        }
        let kind = match &self.0 {
            AnchorError::Db(_) => "db",
            AnchorError::Migration(_) => "migration",
            AnchorError::NotFound(_) => "not_found",
            AnchorError::Invalid(_) => "invalid",
        };
        Out {
            message: self.0.to_string(),
            kind,
        }
        .serialize(ser)
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for ApiError {}
