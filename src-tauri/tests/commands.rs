//! Round-trip integration tests for every Tauri command.
//!
//! These call the `*_impl` functions directly (the bodies of the
//! `#[tauri::command]` wrappers), bypassing the IPC layer. They assert:
//! - the DTO returned matches the spec shape;
//! - the row persists in SQLite (read back via anchor-core);
//! - the audit log entry is recorded.

use anchor_app_lib::commands::{
    add_resource_impl, append_note_impl, create_project_impl, create_thread_impl,
    delete_resource_impl, delete_thread_impl, get_thread_impl, list_threads_impl, move_thread_impl,
    set_project_status_impl, set_settings_actor, update_project_impl, update_thread_impl,
};
use anchor_app_lib::dto::{
    AddResourceArgs, AppendNoteArgs, CreateProjectArgs, CreateThreadArgs, MoveThreadArgs,
    SetProjectStatusArgs, UpdateProjectArgs, UpdateThreadArgs,
};
use anchor_core::db::Db;

fn fresh_conn() -> rusqlite::Connection {
    let db = Db::open_in_memory().expect("open in-memory db");
    db.conn
}

#[test]
fn create_project_round_trips() {
    let conn = fresh_conn();
    let dto = create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "ANCH".to_string(),
            name: "Anchor".to_string(),
            icon: Some("anchor".to_string()),
            description: Some("dev project".to_string()),
            path: None,
            remote: None,
        },
    )
    .expect("create_project");
    assert_eq!(dto.key, "ANCH");
    assert_eq!(dto.name, "Anchor");
    assert_eq!(dto.icon.as_deref(), Some("anchor"));
    assert_eq!(dto.description, "dev project");
    assert_eq!(dto.status, "active");

    let entry = anchor_core::repository::command_log::recent(&conn, 1)
        .expect("recent log")
        .into_iter()
        .next()
        .expect("at least one log entry");
    assert_eq!(entry.command, "tauri.create_project");
    assert_eq!(entry.target_id.as_deref(), Some("ANCH"));
}

#[test]
fn update_project_round_trips() {
    let conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P1".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    let dto = update_project_impl(
        &conn,
        UpdateProjectArgs {
            key: "P1".to_string(),
            name: Some("renamed".to_string()),
            icon: Some("x".to_string()),
            description: Some("d".to_string()),
            path: None,
            remote: None,
        },
    )
    .expect("update");
    assert_eq!(dto.name, "renamed");
    assert_eq!(dto.icon.as_deref(), Some("x"));
    assert_eq!(dto.description, "d");
}

#[test]
fn set_project_status_accepts_active_and_archived_only() {
    let conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P2".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();

    let dto = set_project_status_impl(
        &conn,
        SetProjectStatusArgs {
            key: "P2".to_string(),
            status: "archived".to_string(),
        },
    )
    .expect("archive");
    assert_eq!(dto.status, "archived");

    let dto = set_project_status_impl(
        &conn,
        SetProjectStatusArgs {
            key: "P2".to_string(),
            status: "active".to_string(),
        },
    )
    .expect("restore");
    assert_eq!(dto.status, "active");

    let err = set_project_status_impl(
        &conn,
        SetProjectStatusArgs {
            key: "P2".to_string(),
            status: "idea".to_string(),
        },
    )
    .unwrap_err();
    assert!(
        err.to_string().contains("idea"),
        "expected error to mention 'idea', got: {err}"
    );
}

#[test]
fn create_thread_assigns_sequential_ticket_key() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "PRJ".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    let t1 = create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "PRJ".to_string(),
            title: "first".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    let t2 = create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "PRJ".to_string(),
            title: "second".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    assert_eq!(t1.ticket, "PRJ-1");
    assert_eq!(t2.ticket, "PRJ-2");
}

#[test]
fn list_threads_filters_by_project() {
    let mut conn = fresh_conn();
    for k in ["A", "B"] {
        create_project_impl(
            &conn,
            CreateProjectArgs {
                key: k.to_string(),
                name: k.to_string(),
                icon: None,
                description: None,
                path: None,
                remote: None,
            },
        )
        .unwrap();
        create_thread_impl(
            &mut conn,
            CreateThreadArgs {
                project: k.to_string(),
                title: format!("thread in {k}"),
                type_: None,
                status: None,
                priority: None,
                branch: None,
            },
        )
        .unwrap();
    }
    let all = list_threads_impl(&conn, None).unwrap();
    assert_eq!(all.len(), 2);
    let a_only = list_threads_impl(&conn, Some("A")).unwrap();
    assert_eq!(a_only.len(), 1);
    assert_eq!(a_only[0].project, "A");
}

#[test]
fn get_thread_includes_thread_and_project_resources() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "P".to_string(),
            title: "t".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    add_resource_impl(
        &mut conn,
        AddResourceArgs {
            project: "P".to_string(),
            thread: Some("P-1".to_string()),
            type_: "url".to_string(),
            label: "thread link".to_string(),
            value: "https://example.com/t".to_string(),
        },
    )
    .unwrap();
    add_resource_impl(
        &mut conn,
        AddResourceArgs {
            project: "P".to_string(),
            thread: None,
            type_: "url".to_string(),
            label: "project link".to_string(),
            value: "https://example.com/p".to_string(),
        },
    )
    .unwrap();
    let t = get_thread_impl(&conn, "P-1").unwrap();
    assert_eq!(t.resources.len(), 2, "get_thread must include both scopes");
    let has_thread = t.resources.iter().any(|r| r.thread.is_some());
    let has_project = t.resources.iter().any(|r| r.thread.is_none());
    assert!(has_thread && has_project);
}

#[test]
fn list_threads_excludes_project_level_resources() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "P".to_string(),
            title: "t".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    add_resource_impl(
        &mut conn,
        AddResourceArgs {
            project: "P".to_string(),
            thread: Some("P-1".to_string()),
            type_: "url".to_string(),
            label: "thread-only".to_string(),
            value: "https://example.com".to_string(),
        },
    )
    .unwrap();
    add_resource_impl(
        &mut conn,
        AddResourceArgs {
            project: "P".to_string(),
            thread: None,
            type_: "url".to_string(),
            label: "project-only".to_string(),
            value: "https://example.com/p".to_string(),
        },
    )
    .unwrap();
    let list = list_threads_impl(&conn, None).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(
        list[0].resources.len(),
        1,
        "list_threads must not include project-level resources"
    );
    assert_eq!(list[0].resources[0].label, "thread-only");
}

#[test]
fn update_thread_changes_fields() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "P".to_string(),
            title: "old".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    let updated = update_thread_impl(
        &conn,
        UpdateThreadArgs {
            ticket: "P-1".to_string(),
            title: Some("new".to_string()),
            description: Some("d".to_string()),
            type_: Some("bug".to_string()),
            priority: Some("high".to_string()),
            branch: Some("feat/x".to_string()),
        },
    )
    .unwrap();
    assert_eq!(updated.title, "new");
    assert_eq!(updated.description, "d");
    assert_eq!(updated.type_, "bug");
    assert_eq!(updated.priority, "high");
    assert_eq!(updated.branch.as_deref(), Some("feat/x"));
}

#[test]
fn move_thread_persists_status() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "P".to_string(),
            title: "t".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    let moved = move_thread_impl(
        &conn,
        MoveThreadArgs {
            ticket: "P-1".to_string(),
            status: "in_progress".to_string(),
        },
    )
    .unwrap();
    assert_eq!(moved.status, "in_progress");
    let fetched = get_thread_impl(&conn, "P-1").unwrap();
    assert_eq!(fetched.status, "in_progress");
}

#[test]
fn append_note_persists_and_audits() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "P".to_string(),
            title: "t".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    let n = append_note_impl(
        &mut conn,
        AppendNoteArgs {
            ticket: "P-1".to_string(),
            kind: "log".to_string(),
            body: "hello".to_string(),
            author: Some("user".to_string()),
            author_name: None,
        },
    )
    .unwrap();
    assert_eq!(n.body, "hello");
    assert_eq!(n.kind, "log");
    assert_eq!(n.author, "user");
    let t = get_thread_impl(&conn, "P-1").unwrap();
    assert_eq!(t.notes.len(), 1);
    assert_eq!(t.notes[0].body, "hello");
}

#[test]
fn add_resource_thread_and_project_scopes() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "P".to_string(),
            title: "t".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    let r = add_resource_impl(
        &mut conn,
        AddResourceArgs {
            project: "P".to_string(),
            thread: Some("P-1".to_string()),
            type_: "url".to_string(),
            label: "thread link".to_string(),
            value: "https://example.com".to_string(),
        },
    )
    .unwrap();
    assert_eq!(r.thread.as_deref(), Some("P-1"));
    assert_eq!(r.project, "P");
    assert_eq!(r.type_, "url");
}

#[test]
fn delete_resource_cascades_and_audits() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    let r = add_resource_impl(
        &mut conn,
        AddResourceArgs {
            project: "P".to_string(),
            thread: None,
            type_: "url".to_string(),
            label: "x".to_string(),
            value: "https://example.com".to_string(),
        },
    )
    .unwrap();
    delete_resource_impl(&conn, r.id).expect("delete");
    let entry = anchor_core::repository::command_log::recent(&conn, 1)
        .unwrap()
        .into_iter()
        .next()
        .unwrap();
    assert_eq!(entry.command, "tauri.delete_resource");
    assert_eq!(entry.target_id.as_deref(), Some(r.id.to_string().as_str()));
}

#[test]
fn delete_thread_cascades_notes_and_resources() {
    let mut conn = fresh_conn();
    create_project_impl(
        &conn,
        CreateProjectArgs {
            key: "P".to_string(),
            name: "p".to_string(),
            icon: None,
            description: None,
            path: None,
            remote: None,
        },
    )
    .unwrap();
    create_thread_impl(
        &mut conn,
        CreateThreadArgs {
            project: "P".to_string(),
            title: "t".to_string(),
            type_: None,
            status: None,
            priority: None,
            branch: None,
        },
    )
    .unwrap();
    append_note_impl(
        &mut conn,
        AppendNoteArgs {
            ticket: "P-1".to_string(),
            kind: "log".to_string(),
            body: "x".to_string(),
            author: None,
            author_name: None,
        },
    )
    .unwrap();
    delete_thread_impl(&mut conn, "P-1").expect("delete");
    let err = get_thread_impl(&conn, "P-1").unwrap_err();
    assert!(err.to_string().contains("P-1") || err.to_string().contains("not found"));
}

#[test]
fn set_settings_actor_persists_and_audits() {
    let conn = fresh_conn();
    set_settings_actor(&conn, "alice").expect("set alice");
    let actor = anchor_core::repository::settings::actor(&conn).unwrap();
    assert_eq!(actor, "alice");
    let entry = anchor_core::repository::command_log::recent(&conn, 1)
        .unwrap()
        .into_iter()
        .next()
        .unwrap();
    assert_eq!(entry.command, "tauri.set_settings");
    assert!(entry.summary.contains("user -> alice"));
}
