use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnchorError {
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("migration error: {0}")]
    Migration(#[from] rusqlite_migration::Error),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("invalid value: {0}")]
    Invalid(String),
}

pub type Result<T> = std::result::Result<T, AnchorError>;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn not_found_displays_message() {
        let e = AnchorError::NotFound("project 5".into());
        assert_eq!(e.to_string(), "not found: project 5");
    }
}
