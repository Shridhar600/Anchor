use crate::dto::{
    AddResourceArgs, AppendNoteArgs, CreateProjectArgs, CreateThreadArgs, MoveThreadArgs,
    SetProjectStatusArgs, SetSettingsArgs, UpdateProjectArgs, UpdateThreadArgs,
};
use crate::dto::{NoteDTO, ProjectDTO, ResourceDTO, SettingsDTO, ThreadDTO};
use crate::error::ApiError;
use crate::mapping::{parse_author, project_to_dto, resource_to_dto, LookupMaps};
use crate::state::AppState;
use anchor_core::models::{NoteAuthor, ProjectStatus};
use anchor_core::repository::command_log::{self, NewLogEntry};
use anchor_core::repository::{lookup, note, project, resource, settings, thread};
use anchor_core::AnchorError;
use rusqlite::Connection;
use tauri::State;

fn lock_db<'a>(state: &'a AppState) -> Result<std::sync::MutexGuard<'a, Connection>, ApiError> {
    state
        .db
        .lock()
        .map_err(|e| ApiError(AnchorError::Invalid(format!("db poisoned: {e}"))))
}

fn current_actor(conn: &Connection) -> Result<String, ApiError> {
    settings::actor(conn).map_err(ApiError)
}

fn record_audit(
    conn: &Connection,
    actor: &str,
    command: &str,
    target_type: Option<&str>,
    target_id: Option<&str>,
    summary: &str,
) -> Result<(), ApiError> {
    command_log::record(
        conn,
        NewLogEntry {
            actor: actor.to_string(),
            command: command.to_string(),
            target_type: target_type.map(str::to_string),
            target_id: target_id.map(str::to_string),
            summary: summary.to_string(),
        },
    )
    .map_err(ApiError)
}

fn project_key_for_id(conn: &Connection, project_id: i64) -> String {
    project::get(conn, project_id)
        .map(|p| p.key)
        .unwrap_or_default()
}

fn note_dtos_asc(
    conn: &Connection,
    thread_id: i64,
    maps: &LookupMaps,
) -> Result<Vec<NoteDTO>, ApiError> {
    let mut ns = note::list_by_thread(conn, thread_id).map_err(ApiError)?;
    let mut out: Vec<NoteDTO> = ns
        .drain(..)
        .map(|n| crate::mapping::note_to_dto(&n, maps))
        .collect();
    out.sort_by(|a, b| a.at.cmp(&b.at));
    Ok(out)
}

fn resource_dtos_for_thread(
    conn: &Connection,
    t: &anchor_core::models::Thread,
    maps: &LookupMaps,
    include_project_level: bool,
) -> Result<Vec<ResourceDTO>, ApiError> {
    let project_key = project_key_for_id(conn, t.project_id);
    let rs = if include_project_level {
        resource::list_visible_for_thread(conn, t.id, t.project_id).map_err(ApiError)?
    } else {
        resource::list_by_thread(conn, t.id).map_err(ApiError)?
    };
    Ok(rs
        .iter()
        .map(|r| {
            let tk = if r.thread_id.is_some() {
                Some(t.ticket_key.clone())
            } else {
                None
            };
            resource_to_dto(r, maps, &project_key, tk)
        })
        .collect())
}

fn build_thread_dto(
    conn: &Connection,
    t: &anchor_core::models::Thread,
    maps: &LookupMaps,
    include_project_level_resources: bool,
) -> Result<ThreadDTO, ApiError> {
    let project_key = project_key_for_id(conn, t.project_id);
    let notes = note_dtos_asc(conn, t.id, maps)?;
    let resources = resource_dtos_for_thread(conn, t, maps, include_project_level_resources)?;
    Ok(crate::mapping::thread_to_dto(
        t,
        maps,
        &project_key,
        notes,
        resources,
    ))
}

// ---------- Project ----------

#[tauri::command]
pub fn list_projects(state: State<AppState>) -> Result<Vec<ProjectDTO>, ApiError> {
    let conn = lock_db(&state)?;
    let projects = project::list(&conn).map_err(ApiError)?;
    Ok(projects.iter().map(project_to_dto).collect())
}

#[tauri::command]
pub fn get_project(state: State<AppState>, key: String) -> Result<ProjectDTO, ApiError> {
    let conn = lock_db(&state)?;
    let p = project::get_by_key(&conn, &key).map_err(ApiError)?;
    Ok(project_to_dto(&p))
}

#[tauri::command]
pub fn create_project(
    state: State<AppState>,
    args: CreateProjectArgs,
) -> Result<ProjectDTO, ApiError> {
    let conn = lock_db(&state)?;
    create_project_impl(&conn, args)
}

pub fn create_project_impl(
    conn: &Connection,
    args: CreateProjectArgs,
) -> Result<ProjectDTO, ApiError> {
    let p = project::create(
        conn,
        project::NewProject {
            key: args.key,
            name: args.name,
            description: args.description,
            local_path: args.path,
            git_remote: args.remote,
            icon: args.icon,
            status: ProjectStatus::Active,
        },
    )
    .map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.create_project",
        Some("project"),
        Some(&p.key),
        &format!("{} created: {}", p.key, p.name),
    )?;
    Ok(project_to_dto(&p))
}

#[tauri::command]
pub fn update_project(
    state: State<AppState>,
    args: UpdateProjectArgs,
) -> Result<ProjectDTO, ApiError> {
    let conn = lock_db(&state)?;
    update_project_impl(&conn, args)
}

pub fn update_project_impl(
    conn: &Connection,
    args: UpdateProjectArgs,
) -> Result<ProjectDTO, ApiError> {
    let mut p = project::get_by_key(conn, &args.key).map_err(ApiError)?;
    if let Some(n) = args.name {
        p.name = n;
    }
    if let Some(d) = args.description {
        p.description = Some(d);
    }
    if let Some(path) = args.path {
        p.local_path = Some(path);
    }
    if let Some(r) = args.remote {
        p.git_remote = Some(r);
    }
    if let Some(ic) = args.icon {
        p.icon = Some(ic);
    }
    project::update(conn, &p).map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.update_project",
        Some("project"),
        Some(&p.key),
        &format!("{} updated", p.key),
    )?;
    Ok(project_to_dto(&p))
}

#[tauri::command]
pub fn set_project_status(
    state: State<AppState>,
    args: SetProjectStatusArgs,
) -> Result<ProjectDTO, ApiError> {
    let conn = lock_db(&state)?;
    set_project_status_impl(&conn, args)
}

pub fn set_project_status_impl(
    conn: &Connection,
    args: SetProjectStatusArgs,
) -> Result<ProjectDTO, ApiError> {
    let mut p = project::get_by_key(conn, &args.key).map_err(ApiError)?;
    p.status = match args.status.as_str() {
        "active" => ProjectStatus::Active,
        "archived" => ProjectStatus::Archived,
        other => {
            return Err(ApiError(AnchorError::Invalid(format!(
                "project status '{other}'; expected 'active' or 'archived'"
            ))))
        }
    };
    project::update(conn, &p).map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.set_project_status",
        Some("project"),
        Some(&p.key),
        &format!("{} -> {}", p.key, p.status.as_str()),
    )?;
    Ok(project_to_dto(&p))
}

// ---------- Thread ----------

#[tauri::command]
pub fn list_threads(
    state: State<AppState>,
    project: Option<String>,
) -> Result<Vec<ThreadDTO>, ApiError> {
    let conn = lock_db(&state)?;
    list_threads_impl(&conn, project.as_deref())
}

pub fn list_threads_impl(
    conn: &Connection,
    project: Option<&str>,
) -> Result<Vec<ThreadDTO>, ApiError> {
    let maps = LookupMaps::load(conn).map_err(ApiError)?;
    let threads = match project {
        Some(key) => {
            let p = project::get_by_key(conn, key).map_err(ApiError)?;
            thread::list_by_project(conn, p.id).map_err(ApiError)?
        }
        None => thread::list_all(conn).map_err(ApiError)?,
    };
    threads
        .iter()
        .map(|t| build_thread_dto(conn, t, &maps, false))
        .collect()
}

#[tauri::command]
pub fn get_thread(state: State<AppState>, ticket: String) -> Result<ThreadDTO, ApiError> {
    let conn = lock_db(&state)?;
    get_thread_impl(&conn, &ticket)
}

pub fn get_thread_impl(conn: &Connection, ticket: &str) -> Result<ThreadDTO, ApiError> {
    let maps = LookupMaps::load(conn).map_err(ApiError)?;
    let t = thread::get_by_ticket_key(conn, ticket).map_err(ApiError)?;
    build_thread_dto(conn, &t, &maps, true)
}

#[tauri::command]
pub fn create_thread(
    state: State<AppState>,
    args: CreateThreadArgs,
) -> Result<ThreadDTO, ApiError> {
    let mut conn = lock_db(&state)?;
    create_thread_impl(&mut conn, args)
}

pub fn create_thread_impl(
    conn: &mut Connection,
    args: CreateThreadArgs,
) -> Result<ThreadDTO, ApiError> {
    let proj = project::get_by_key(conn, &args.project).map_err(ApiError)?;
    let type_id = lookup::id_for_key(
        conn,
        "thread_types",
        args.type_.as_deref().unwrap_or("feature"),
    )
    .map_err(ApiError)?;
    let status_id = lookup::id_for_key(
        conn,
        "statuses",
        args.status.as_deref().unwrap_or("backlog"),
    )
    .map_err(ApiError)?;
    let priority_id = lookup::id_for_key(
        conn,
        "priorities",
        args.priority.as_deref().unwrap_or("med"),
    )
    .map_err(ApiError)?;
    let t = thread::create(
        conn,
        thread::NewThread {
            project_id: proj.id,
            title: args.title,
            description: None,
            type_id,
            status_id,
            priority_id,
            git_branch: args.branch,
        },
    )
    .map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.create_thread",
        Some("thread"),
        Some(&t.ticket_key),
        &format!("{} created: {}", t.ticket_key, t.title),
    )?;
    let maps = LookupMaps::load(conn).map_err(ApiError)?;
    build_thread_dto(conn, &t, &maps, false)
}

#[tauri::command]
pub fn update_thread(
    state: State<AppState>,
    args: UpdateThreadArgs,
) -> Result<ThreadDTO, ApiError> {
    let conn = lock_db(&state)?;
    update_thread_impl(&conn, args)
}

pub fn update_thread_impl(
    conn: &Connection,
    args: UpdateThreadArgs,
) -> Result<ThreadDTO, ApiError> {
    let mut t = thread::get_by_ticket_key(conn, &args.ticket).map_err(ApiError)?;
    if let Some(title) = args.title {
        t.title = title;
    }
    if let Some(d) = args.description {
        t.description = Some(d);
    }
    if let Some(type_) = args.type_ {
        t.type_id = lookup::id_for_key(conn, "thread_types", &type_).map_err(ApiError)?;
    }
    if let Some(prio) = args.priority {
        t.priority_id = lookup::id_for_key(conn, "priorities", &prio).map_err(ApiError)?;
    }
    if let Some(b) = args.branch {
        t.git_branch = Some(b);
    }
    thread::update(conn, &t).map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.update_thread",
        Some("thread"),
        Some(&t.ticket_key),
        &format!("{} updated", t.ticket_key),
    )?;
    let maps = LookupMaps::load(conn).map_err(ApiError)?;
    build_thread_dto(conn, &t, &maps, true)
}

#[tauri::command]
pub fn move_thread(state: State<AppState>, args: MoveThreadArgs) -> Result<ThreadDTO, ApiError> {
    let conn = lock_db(&state)?;
    move_thread_impl(&conn, args)
}

pub fn move_thread_impl(conn: &Connection, args: MoveThreadArgs) -> Result<ThreadDTO, ApiError> {
    let t = thread::get_by_ticket_key(conn, &args.ticket).map_err(ApiError)?;
    let status_id = lookup::id_for_key(conn, "statuses", &args.status).map_err(ApiError)?;
    thread::update_status(conn, t.id, status_id).map_err(ApiError)?;
    let t = thread::get(conn, t.id).map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.move_thread",
        Some("thread"),
        Some(&t.ticket_key),
        &format!("{} -> {}", t.ticket_key, args.status),
    )?;
    let maps = LookupMaps::load(conn).map_err(ApiError)?;
    build_thread_dto(conn, &t, &maps, true)
}

#[tauri::command]
pub fn delete_thread(state: State<AppState>, ticket: String) -> Result<(), ApiError> {
    let mut conn = lock_db(&state)?;
    delete_thread_impl(&mut conn, &ticket)
}

pub fn delete_thread_impl(conn: &mut Connection, ticket: &str) -> Result<(), ApiError> {
    let t = thread::get_by_ticket_key(conn, ticket).map_err(ApiError)?;
    thread::delete(conn, t.id).map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.delete_thread",
        Some("thread"),
        Some(&t.ticket_key),
        &format!("{} deleted", t.ticket_key),
    )?;
    Ok(())
}

// ---------- Notes (append-only) ----------

#[tauri::command]
pub fn append_note(state: State<AppState>, args: AppendNoteArgs) -> Result<NoteDTO, ApiError> {
    let mut conn = lock_db(&state)?;
    append_note_impl(&mut conn, args)
}

pub fn append_note_impl(conn: &mut Connection, args: AppendNoteArgs) -> Result<NoteDTO, ApiError> {
    let t = thread::get_by_ticket_key(conn, &args.ticket).map_err(ApiError)?;
    let actor_string = current_actor(conn)?;
    let author = match args.author {
        Some(s) => parse_author(&s)?,
        None => match actor_string.as_str() {
            "agent" => NoteAuthor::Agent,
            _ => NoteAuthor::User,
        },
    };
    let kind_id = lookup::id_for_key(conn, "note_kinds", &args.kind).map_err(ApiError)?;
    let n = note::add(
        conn,
        note::NewNote {
            thread_id: t.id,
            author,
            author_name: args.author_name,
            kind_id,
            body: args.body,
        },
    )
    .map_err(ApiError)?;
    record_audit(
        conn,
        &actor_string,
        "tauri.append_note",
        Some("thread"),
        Some(&t.ticket_key),
        &format!("note {} on {}", n.id, t.ticket_key),
    )?;
    let maps = LookupMaps::load(conn).map_err(ApiError)?;
    Ok(crate::mapping::note_to_dto(&n, &maps))
}

// ---------- Resources ----------

#[tauri::command]
pub fn add_resource(
    state: State<AppState>,
    args: AddResourceArgs,
) -> Result<ResourceDTO, ApiError> {
    let mut conn = lock_db(&state)?;
    add_resource_impl(&mut conn, args)
}

pub fn add_resource_impl(
    conn: &mut Connection,
    args: AddResourceArgs,
) -> Result<ResourceDTO, ApiError> {
    let proj = project::get_by_key(conn, &args.project).map_err(ApiError)?;
    let type_id = lookup::id_for_key(conn, "resource_types", &args.type_).map_err(ApiError)?;
    let (thread_id, thread_key) = match &args.thread {
        Some(tk) => {
            let t = thread::get_by_ticket_key(conn, tk).map_err(ApiError)?;
            (Some(t.id), Some(t.ticket_key))
        }
        None => (None, None),
    };
    let r = resource::add(
        conn,
        resource::NewResource {
            project_id: proj.id,
            thread_id,
            type_id,
            label: args.label,
            value: args.value,
        },
    )
    .map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.add_resource",
        Some("resource"),
        Some(&r.id.to_string()),
        &format!("resource {} on project {}", r.id, proj.key),
    )?;
    let maps = LookupMaps::load(conn).map_err(ApiError)?;
    Ok(resource_to_dto(&r, &maps, &proj.key, thread_key))
}

#[tauri::command]
pub fn delete_resource(state: State<AppState>, resource_id: i64) -> Result<(), ApiError> {
    let conn = lock_db(&state)?;
    delete_resource_impl(&conn, resource_id)
}

pub fn delete_resource_impl(conn: &Connection, resource_id: i64) -> Result<(), ApiError> {
    resource::delete(conn, resource_id).map_err(ApiError)?;
    let actor = current_actor(conn)?;
    record_audit(
        conn,
        &actor,
        "tauri.delete_resource",
        Some("resource"),
        Some(&resource_id.to_string()),
        &format!("resource {resource_id} deleted"),
    )?;
    Ok(())
}

// ---------- Settings ----------

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<SettingsDTO, ApiError> {
    let conn = lock_db(&state)?;
    let actor = current_actor(&conn)?;
    Ok(SettingsDTO {
        actor,
        db_path: state.db_path.clone(),
    })
}

#[tauri::command]
pub fn set_settings(
    state: State<AppState>,
    args: SetSettingsArgs,
) -> Result<SettingsDTO, ApiError> {
    let conn = lock_db(&state)?;
    if let Some(a) = &args.actor {
        if a.is_empty() {
            return Err(ApiError(AnchorError::Invalid(
                "actor cannot be empty".into(),
            )));
        }
        set_settings_actor(&conn, a)?;
    }
    let actor = current_actor(&conn)?;
    Ok(SettingsDTO {
        actor,
        db_path: state.db_path.clone(),
    })
}

pub fn set_settings_actor(conn: &Connection, new_actor: &str) -> Result<(), ApiError> {
    if new_actor.is_empty() {
        return Err(ApiError(AnchorError::Invalid(
            "actor cannot be empty".into(),
        )));
    }
    let previous = settings::actor(conn).map_err(ApiError)?;
    settings::set_actor(conn, new_actor).map_err(ApiError)?;
    record_audit(
        conn,
        &previous,
        "tauri.set_settings",
        Some("settings"),
        Some("actor"),
        &format!("actor: {} -> {}", previous, new_actor),
    )?;
    Ok(())
}
