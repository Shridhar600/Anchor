use crate::error::{AnchorError, Result};
use serde::Serialize;

/// Whether a project is active, archived, or just an idea.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    #[default]
    Active,
    Archived,
    Idea,
}

impl ProjectStatus {
    /// Return the serialized string form.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Archived => "archived",
            Self::Idea => "idea",
        }
    }
}

impl std::str::FromStr for ProjectStatus {
    type Err = AnchorError;
    fn from_str(s: &str) -> Result<Self> {
        match s {
            "active" => Ok(Self::Active),
            "archived" => Ok(Self::Archived),
            "idea" => Ok(Self::Idea),
            other => Err(AnchorError::Invalid(format!("project status '{other}'"))),
        }
    }
}

/// Whether a note was written by a user or an AI agent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NoteAuthor {
    User,
    Agent,
}

impl NoteAuthor {
    /// Return the serialized string form.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Agent => "agent",
        }
    }
}

impl std::str::FromStr for NoteAuthor {
    type Err = AnchorError;
    fn from_str(s: &str) -> Result<Self> {
        match s {
            "user" => Ok(Self::User),
            "agent" => Ok(Self::Agent),
            other => Err(AnchorError::Invalid(format!("note author '{other}'"))),
        }
    }
}

/// A row from a generic lookup table (id, key, label).
#[derive(Debug, Clone, Serialize)]
pub struct LookupRow {
    pub id: i64,
    pub key: String,
    pub label: String,
}

/// A tracked development project.
#[derive(Debug, Clone, Serialize)]
pub struct Project {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub description: Option<String>,
    pub local_path: Option<String>,
    pub git_remote: Option<String>,
    pub icon: Option<String>,
    pub status: ProjectStatus,
    pub thread_counter: i64,
    pub created_at: String,
    pub updated_at: String,
}

/// A ticket / issue within a project.
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

/// A note attached to a thread.
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

/// A resource (URL, file, etc.) scoped to a project or a thread.
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

/// An entry in the append-only command audit log.
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
            "idea".parse::<ProjectStatus>().unwrap(),
            ProjectStatus::Idea
        );
        assert_eq!(ProjectStatus::Archived.as_str(), "archived");
        assert!("bogus".parse::<ProjectStatus>().is_err());
    }

    #[test]
    fn note_author_roundtrip() {
        assert_eq!("agent".parse::<NoteAuthor>().unwrap(), NoteAuthor::Agent);
        assert_eq!(NoteAuthor::User.as_str(), "user");
        assert!("nobody".parse::<NoteAuthor>().is_err());
    }

    #[test]
    fn project_status_serializes_as_lowercase() {
        let json = serde_json::to_string(&ProjectStatus::Active).unwrap();
        assert_eq!(json, "\"active\"");
    }
}
