use crate::error::{AnchorError, Result};
use crate::models::{Project, ProjectStatus};
use rusqlite::{Connection, OptionalExtension};

pub struct NewProject {
    pub key: String,
    pub name: String,
    pub description: Option<String>,
    pub local_path: Option<String>,
    pub git_remote: Option<String>,
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
        status: ProjectStatus::from_str(&r.get::<_, String>("status")?)
            .unwrap_or(ProjectStatus::Active),
        thread_counter: r.get("thread_counter")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

pub fn create(conn: &Connection, p: NewProject) -> Result<Project> {
    conn.execute(
        "INSERT INTO projects (key, name, description, local_path, git_remote, status, thread_counter, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        rusqlite::params![p.key, p.name, p.description, p.local_path, p.git_remote, p.status.as_str()],
    )?;
    let id = conn.last_insert_rowid();
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<Project> {
    conn.query_row("SELECT * FROM projects WHERE id = ?1", [id], map_row)
        .optional()?
        .ok_or_else(|| AnchorError::NotFound(format!("project {id}")))
}

pub fn get_by_key(conn: &Connection, key: &str) -> Result<Project> {
    conn.query_row("SELECT * FROM projects WHERE key = ?1", [key], map_row)
        .optional()?
        .ok_or_else(|| AnchorError::NotFound(format!("project key '{key}'")))
}

pub fn list(conn: &Connection) -> Result<Vec<Project>> {
    let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY name")?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn update(conn: &Connection, p: &Project) -> Result<()> {
    let n = conn.execute(
        "UPDATE projects SET name=?2, description=?3, local_path=?4, git_remote=?5, status=?6,
         updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?1",
        rusqlite::params![
            p.id,
            p.name,
            p.description,
            p.local_path,
            p.git_remote,
            p.status.as_str()
        ],
    )?;
    if n == 0 {
        return Err(AnchorError::NotFound(format!("project {}", p.id)));
    }
    Ok(())
}

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
}
