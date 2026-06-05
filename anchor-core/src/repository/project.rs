use crate::error::{AnchorError, Result};
use crate::models::{Project, ProjectStatus};
use rusqlite::{Connection, OptionalExtension};

/// Input for creating a new project.
#[derive(Debug, Default)]
pub struct NewProject {
    pub key: String,
    pub name: String,
    pub description: Option<String>,
    pub local_path: Option<String>,
    pub git_remote: Option<String>,
    pub icon: Option<String>,
    pub status: ProjectStatus,
}

fn map_row(r: &rusqlite::Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: r.get("id")?,
        key: r.get("key")?,
        name: r.get("name")?,
        description: r.get("description")?,
        local_path: r.get("local_path")?,
        git_remote: r.get("git_remote")?,
        icon: r.get("icon")?,
        status: {
            let s: String = r.get("status")?;
            s.parse::<ProjectStatus>().map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?
        },
        thread_counter: r.get("thread_counter")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

/// Create a new project and return its full row.
pub fn create(conn: &Connection, p: NewProject) -> Result<Project> {
    conn.execute(
        "INSERT INTO projects (key, name, description, local_path, git_remote, icon, status, thread_counter, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        rusqlite::params![p.key, p.name, p.description, p.local_path, p.git_remote, p.icon, p.status.as_str()],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

/// Get a project by its numeric id.
pub fn get(conn: &Connection, id: i64) -> Result<Project> {
    conn.query_row("SELECT * FROM projects WHERE id = ?1", [id], map_row)
        .optional()?
        .ok_or_else(|| AnchorError::NotFound(format!("project {id}")))
}

/// Get a project by its unique key string.
pub fn get_by_key(conn: &Connection, key: &str) -> Result<Project> {
    conn.query_row("SELECT * FROM projects WHERE key = ?1", [key], map_row)
        .optional()?
        .ok_or_else(|| AnchorError::NotFound(format!("project key '{key}'")))
}

/// List all projects ordered by name.
pub fn list(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY name")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Update a project's mutable fields. Returns `NotFound` if the id doesn't exist.
pub fn update(conn: &Connection, p: &Project) -> Result<()> {
    let n = conn.execute(
        "UPDATE projects SET name=?2, description=?3, local_path=?4, git_remote=?5, icon=?6, status=?7,
         updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?1",
        rusqlite::params![
            p.id,
            p.name,
            p.description,
            p.local_path,
            p.git_remote,
            p.icon,
            p.status.as_str()
        ],
    )?;
    if n == 0 {
        return Err(AnchorError::NotFound(format!("project {}", p.id)));
    }
    Ok(())
}

/// Delete a project and all its children (threads, notes, resources, custom statuses).
pub fn delete(conn: &mut Connection, id: i64) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM thread_notes WHERE thread_id IN (SELECT id FROM threads WHERE project_id=?1)",
        [id],
    )?;
    tx.execute("DELETE FROM resources WHERE project_id=?1", [id])?;
    tx.execute("DELETE FROM threads WHERE project_id=?1", [id])?;
    tx.execute("DELETE FROM statuses WHERE project_id=?1", [id])?;
    let n = tx.execute("DELETE FROM projects WHERE id=?1", [id])?;
    tx.commit()?;
    if n == 0 {
        return Err(AnchorError::NotFound(format!("project {id}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    fn sample() -> NewProject {
        NewProject {
            key: "DEVOS".into(),
            name: "Anchor".into(),
            description: Some("dev project manager".into()),
            local_path: Some("/tmp/anchor".into()),
            git_remote: None,
            icon: None,
            status: ProjectStatus::Active,
        }
    }

    #[test]
    fn create_and_get() {
        let db = Db::open_in_memory().unwrap();
        let p = create(&db.conn, sample()).unwrap();
        assert_eq!(p.key, "DEVOS");
        assert_eq!(p.thread_counter, 0);
        let fetched = get(&db.conn, p.id).unwrap();
        assert_eq!(fetched.name, "Anchor");
    }

    #[test]
    fn get_missing_is_not_found() {
        let db = Db::open_in_memory().unwrap();
        assert!(matches!(get(&db.conn, 999), Err(AnchorError::NotFound(_))));
    }

    #[test]
    fn delete_cascades() {
        let mut db = Db::open_in_memory().unwrap();
        let p = create(&db.conn, sample()).unwrap();
        delete(&mut db.conn, p.id).unwrap();
        assert!(get(&db.conn, p.id).is_err());
    }

    #[test]
    fn get_with_corrupt_status_errors() {
        let db = Db::open_in_memory().unwrap();
        let p = create(&db.conn, sample()).unwrap();
        db.conn
            .execute("UPDATE projects SET status='bogus' WHERE id=?1", [p.id])
            .unwrap();
        assert!(get(&db.conn, p.id).is_err());
    }

    #[test]
    fn update_persists_changes() {
        let db = Db::open_in_memory().unwrap();
        let mut p = create(&db.conn, sample()).unwrap();
        p.name = "Renamed".into();
        p.status = ProjectStatus::Archived;
        update(&db.conn, &p).unwrap();
        let got = get(&db.conn, p.id).unwrap();
        assert_eq!(got.name, "Renamed");
        assert_eq!(got.status, ProjectStatus::Archived);
    }

    #[test]
    fn update_missing_is_not_found() {
        let db = Db::open_in_memory().unwrap();
        let mut p = create(&db.conn, sample()).unwrap();
        p.id = 999;
        assert!(matches!(
            update(&db.conn, &p),
            Err(AnchorError::NotFound(_))
        ));
    }

    #[test]
    fn icon_round_trips_through_create_and_update() {
        let db = Db::open_in_memory().unwrap();
        let mut p = create(
            &db.conn,
            NewProject {
                icon: Some("🛶".into()),
                ..sample()
            },
        )
        .unwrap();
        assert_eq!(p.icon.as_deref(), Some("🛶"));
        let fetched = get(&db.conn, p.id).unwrap();
        assert_eq!(fetched.icon.as_deref(), Some("🛶"));
        p.icon = None;
        update(&db.conn, &p).unwrap();
        let fetched = get(&db.conn, p.id).unwrap();
        assert_eq!(fetched.icon, None);
    }
}
