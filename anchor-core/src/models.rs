use crate::error::{AnchorError, Result};
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    Active,
    Archived,
    Idea,
}

impl ProjectStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Archived => "archived",
            Self::Idea => "idea",
        }
    }
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Result<Self> {
        match s {
            "active" => Ok(Self::Active),
            "archived" => Ok(Self::Archived),
            "idea" => Ok(Self::Idea),
            other => Err(AnchorError::Invalid(format!("project status '{other}'"))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NoteAuthor {
    User,
    Agent,
}

impl NoteAuthor {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Agent => "agent",
        }
    }
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Result<Self> {
        match s {
            "user" => Ok(Self::User),
            "agent" => Ok(Self::Agent),
            other => Err(AnchorError::Invalid(format!("note author '{other}'"))),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LookupRow {
    pub id: i64,
    pub key: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Project {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub description: Option<String>,
    pub local_path: Option<String>,
    pub git_remote: Option<String>,
    pub status: ProjectStatus,
    pub thread_counter: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Thread {
    pub id: i64,
    pub project_id: i64,
    pub ticket_key: String,
    pub title: String,
    pub description: Option<String>,
    pub type_id: i64,
    pub status_id: i64,
    pub priority_id: i64,
    pub git_branch: Option<String>,
    pub order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThreadNote {
    pub id: i64,
    pub thread_id: i64,
    pub author: NoteAuthor,
    pub author_name: Option<String>,
    pub kind_id: i64,
    pub body: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Resource {
    pub id: i64,
    pub project_id: i64,
    pub thread_id: Option<i64>,
    pub type_id: i64,
    pub label: String,
    pub value: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandLogEntry {
    pub id: i64,
    pub ts: String,
    pub actor: String,
    pub command: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub summary: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn project_status_roundtrip() {
        assert_eq!(
            ProjectStatus::from_str("idea").unwrap(),
            ProjectStatus::Idea
        );
        assert_eq!(ProjectStatus::Archived.as_str(), "archived");
        assert!(ProjectStatus::from_str("bogus").is_err());
    }

    #[test]
    fn project_status_serializes_as_lowercase() {
        let json = serde_json::to_string(&ProjectStatus::Active).unwrap();
        assert_eq!(json, "\"active\"");
    }
}
