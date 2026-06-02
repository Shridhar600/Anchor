use crate::dto::{NoteDTO, ProjectDTO, ResourceDTO, ThreadDTO};
use anchor_core::models::{NoteAuthor, Project, ProjectStatus, Resource, Thread, ThreadNote};
use anchor_core::repository::lookup;
use rusqlite::Connection;
use std::collections::HashMap;

pub struct LookupMaps {
    pub thread_types: HashMap<i64, String>,
    pub statuses: HashMap<i64, String>,
    pub priorities: HashMap<i64, String>,
    pub resource_types: HashMap<i64, String>,
    pub note_kinds: HashMap<i64, String>,
}

impl LookupMaps {
    pub fn load(conn: &Connection) -> Result<Self, anchor_core::AnchorError> {
        Ok(Self {
            thread_types: id_to_key_map(lookup::thread_types(conn)?),
            statuses: id_to_key_map(lookup::global_statuses(conn)?),
            priorities: id_to_key_map(lookup::priorities(conn)?),
            resource_types: id_to_key_map(lookup::resource_types(conn)?),
            note_kinds: id_to_key_map(lookup::note_kinds(conn)?),
        })
    }

    pub fn thread_type_key(&self, id: i64) -> String {
        self.thread_types
            .get(&id)
            .cloned()
            .unwrap_or_else(|| "feature".to_string())
    }

    pub fn status_key(&self, id: i64) -> String {
        self.statuses
            .get(&id)
            .cloned()
            .unwrap_or_else(|| "backlog".to_string())
    }

    pub fn priority_key(&self, id: i64) -> String {
        self.priorities
            .get(&id)
            .cloned()
            .unwrap_or_else(|| "med".to_string())
    }

    pub fn resource_type_key(&self, id: i64) -> String {
        self.resource_types
            .get(&id)
            .cloned()
            .unwrap_or_else(|| "url".to_string())
    }

    pub fn note_kind_key(&self, id: i64) -> String {
        self.note_kinds
            .get(&id)
            .cloned()
            .unwrap_or_else(|| "log".to_string())
    }
}

fn id_to_key_map(rows: Vec<anchor_core::models::LookupRow>) -> HashMap<i64, String> {
    rows.into_iter().map(|r| (r.id, r.key)).collect()
}

pub fn project_to_dto(p: &Project) -> ProjectDTO {
    let path = p.local_path.clone().unwrap_or_default();
    let branch = if path.is_empty() {
        String::new()
    } else {
        anchor_core::git::current_branch(&path)
    };
    ProjectDTO {
        key: p.key.clone(),
        name: p.name.clone(),
        icon: p.icon.clone(),
        description: p.description.clone().unwrap_or_default(),
        path,
        remote: p.git_remote.clone().unwrap_or_default(),
        branch,
        status: project_status_key(&p.status).to_string(),
        started: p.created_at.clone(),
    }
}

fn project_status_key(s: &ProjectStatus) -> &'static str {
    match s {
        ProjectStatus::Active => "active",
        ProjectStatus::Archived => "archived",
        ProjectStatus::Idea => "idea",
    }
}

pub fn note_to_dto(n: &ThreadNote, maps: &LookupMaps) -> NoteDTO {
    NoteDTO {
        author: n.author.as_str().to_string(),
        author_name: n.author_name.clone(),
        kind: maps.note_kind_key(n.kind_id),
        body: n.body.clone(),
        at: n.created_at.clone(),
    }
}

pub fn resource_to_dto(
    r: &Resource,
    maps: &LookupMaps,
    project_key: &str,
    thread_key: Option<String>,
) -> ResourceDTO {
    ResourceDTO {
        id: r.id,
        type_: maps.resource_type_key(r.type_id),
        label: r.label.clone(),
        value: r.value.clone(),
        thread: thread_key,
        project: project_key.to_string(),
    }
}

pub fn thread_to_dto(
    t: &Thread,
    maps: &LookupMaps,
    project_key: &str,
    notes: Vec<NoteDTO>,
    resources: Vec<ResourceDTO>,
) -> ThreadDTO {
    ThreadDTO {
        ticket: t.ticket_key.clone(),
        project: project_key.to_string(),
        title: t.title.clone(),
        description: t.description.clone().unwrap_or_default(),
        type_: maps.thread_type_key(t.type_id),
        status: maps.status_key(t.status_id),
        priority: maps.priority_key(t.priority_id),
        branch: t.git_branch.clone(),
        notes,
        resources,
    }
}

/// Helper: classify the author enum from a string key.
pub fn parse_author(s: &str) -> Result<NoteAuthor, anchor_core::AnchorError> {
    match s {
        "user" => Ok(NoteAuthor::User),
        "agent" => Ok(NoteAuthor::Agent),
        other => Err(anchor_core::AnchorError::Invalid(format!(
            "note author '{other}'"
        ))),
    }
}
