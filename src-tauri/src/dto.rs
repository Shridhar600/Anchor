use serde::{Deserialize, Serialize};

/// Project DTO. Keys, not ids. `branch` is derived live from the project's
/// local git HEAD by the command layer (delta 2).
#[derive(Debug, Clone, Serialize)]
pub struct ProjectDTO {
    pub key: String,
    pub name: String,
    pub icon: Option<String>,
    pub description: String,
    pub path: String,
    pub remote: String,
    pub branch: String,
    pub status: String,
    pub started: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThreadDTO {
    pub ticket: String,
    pub project: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub status: String,
    pub priority: String,
    pub branch: Option<String>,
    pub notes: Vec<NoteDTO>,
    pub resources: Vec<ResourceDTO>,
}

#[derive(Debug, Clone, Serialize)]
pub struct NoteDTO {
    pub author: String,
    pub author_name: Option<String>,
    pub kind: String,
    pub body: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResourceDTO {
    pub id: i64,
    #[serde(rename = "type")]
    pub type_: String,
    pub label: String,
    pub value: String,
    pub thread: Option<String>,
    pub project: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SettingsDTO {
    pub actor: String,
    pub db_path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateProjectArgs {
    pub key: String,
    pub name: String,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub path: Option<String>,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateProjectArgs {
    pub key: String,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub description: Option<String>,
    pub path: Option<String>,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetProjectStatusArgs {
    pub key: String,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CreateThreadArgs {
    pub project: String,
    pub title: String,
    #[serde(rename = "type")]
    pub type_: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UpdateThreadArgs {
    pub ticket: String,
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub type_: Option<String>,
    pub priority: Option<String>,
    pub branch: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MoveThreadArgs {
    pub ticket: String,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AppendNoteArgs {
    pub ticket: String,
    pub kind: String,
    pub body: String,
    pub author: Option<String>,
    pub author_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AddResourceArgs {
    pub project: String,
    pub thread: Option<String>,
    #[serde(rename = "type")]
    pub type_: String,
    pub label: String,
    pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SetSettingsArgs {
    pub actor: Option<String>,
}
