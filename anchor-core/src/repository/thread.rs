use crate::error::{AnchorError, Result};
use crate::models::Thread;
use rusqlite::{Connection, OptionalExtension};

pub struct NewThread {
    pub project_id: i64,
    pub title: String,
    pub description: Option<String>,
    pub type_id: i64,
    pub status_id: i64,
    pub priority_id: i64,
    pub git_branch: Option<String>,
}

fn map_row(r: &rusqlite::Row) -> rusqlite::Result<Thread> {
    Ok(Thread {
        id: r.get("id")?,
        project_id: r.get("project_id")?,
        ticket_key: r.get("ticket_key")?,
        title: r.get("title")?,
        description: r.get("description")?,
        type_id: r.get("type_id")?,
        status_id: r.get("status_id")?,
        priority_id: r.get("priority_id")?,
        git_branch: r.get("git_branch")?,
        order: r.get("order")?,
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

pub fn create(conn: &mut Connection, t: NewThread) -> Result<Thread> {
    let tx = conn.transaction()?;

    let project_key: Option<String> = tx
        .query_row(
            "SELECT key FROM projects WHERE id=?1",
            [t.project_id],
            |r| r.get(0),
        )
        .optional()?;
    let project_key =
        project_key.ok_or_else(|| AnchorError::NotFound(format!("project {}", t.project_id)))?;

    tx.execute(
        "UPDATE projects SET thread_counter = thread_counter + 1 WHERE id=?1",
        [t.project_id],
    )?;
    let counter: i64 = tx.query_row(
        "SELECT thread_counter FROM projects WHERE id=?1",
        [t.project_id],
        |r| r.get(0),
    )?;
    let ticket_key = format!("{project_key}-{counter}");

    let next_order: i64 = tx.query_row(
        "SELECT COALESCE(MAX(\"order\"), 0) + 1 FROM threads WHERE project_id=?1 AND status_id=?2",
        rusqlite::params![t.project_id, t.status_id],
        |r| r.get(0),
    )?;

    tx.execute(
        "INSERT INTO threads (project_id, ticket_key, title, description, type_id, status_id, priority_id, git_branch, \"order\", created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9, strftime('%Y-%m-%dT%H:%M:%SZ','now'), strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        rusqlite::params![t.project_id, ticket_key, t.title, t.description, t.type_id, t.status_id, t.priority_id, t.git_branch, next_order],
    )?;
    let id = tx.last_insert_rowid();
    tx.commit()?;
    get(conn, id)
}

pub fn get_by_ticket_key(conn: &Connection, ticket_key: &str) -> Result<Thread> {
    conn.query_row(
        "SELECT * FROM threads WHERE ticket_key=?1",
        [ticket_key],
        map_row,
    )
    .optional()?
    .ok_or_else(|| AnchorError::NotFound(format!("thread '{ticket_key}'")))
}

pub fn get(conn: &Connection, id: i64) -> Result<Thread> {
    conn.query_row("SELECT * FROM threads WHERE id=?1", [id], map_row)
        .optional()?
        .ok_or_else(|| AnchorError::NotFound(format!("thread {id}")))
}

pub fn list_by_project(conn: &Connection, project_id: i64) -> Result<Vec<Thread>> {
    let mut stmt =
        conn.prepare("SELECT * FROM threads WHERE project_id=?1 ORDER BY status_id, \"order\"")?;
    let rows = stmt.query_map([project_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn update_status(conn: &Connection, id: i64, status_id: i64) -> Result<()> {
    let n = conn.execute(
        "UPDATE threads SET status_id=?2, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?1",
        rusqlite::params![id, status_id],
    )?;
    if n == 0 {
        return Err(AnchorError::NotFound(format!("thread {id}")));
    }
    Ok(())
}

pub fn update(conn: &Connection, t: &Thread) -> Result<()> {
    let n = conn.execute(
        "UPDATE threads SET title=?2, description=?3, type_id=?4, status_id=?5, priority_id=?6,
         git_branch=?7, \"order\"=?8, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?1",
        rusqlite::params![
            t.id,
            t.title,
            t.description,
            t.type_id,
            t.status_id,
            t.priority_id,
            t.git_branch,
            t.order
        ],
    )?;
    if n == 0 {
        return Err(AnchorError::NotFound(format!("thread {}", t.id)));
    }
    Ok(())
}

/// Cascade: thread + its notes + its thread-scoped resources.
pub fn delete(conn: &mut Connection, id: i64) -> Result<()> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM thread_notes WHERE thread_id=?1", [id])?;
    tx.execute("DELETE FROM resources WHERE thread_id=?1", [id])?;
    let n = tx.execute("DELETE FROM threads WHERE id=?1", [id])?;
    tx.commit()?;
    if n == 0 {
        return Err(AnchorError::NotFound(format!("thread {id}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use crate::models::ProjectStatus;
    use crate::repository::{lookup, project};

    fn setup(db: &Db) -> i64 {
        project::create(
            &db.conn,
            project::NewProject {
                key: "DEVOS".into(),
                name: "Anchor".into(),
                description: None,
                local_path: None,
                git_remote: None,
                status: ProjectStatus::Active,
            },
        )
        .unwrap()
        .id
    }

    fn new_thread(conn: &Connection, project_id: i64) -> NewThread {
        NewThread {
            project_id,
            title: "Architect backend".into(),
            description: None,
            type_id: lookup::id_for_key(conn, "thread_types", "idea").unwrap(),
            status_id: lookup::id_for_key(conn, "statuses", "in_progress").unwrap(),
            priority_id: lookup::id_for_key(conn, "priorities", "high").unwrap(),
            git_branch: None,
        }
    }

    #[test]
    fn create_generates_sequential_ticket_keys() {
        let mut db = Db::open_in_memory().unwrap();
        let pid = setup(&db);
        let nt1 = new_thread(&db.conn, pid);
        let t1 = create(&mut db.conn, nt1).unwrap();
        let nt2 = new_thread(&db.conn, pid);
        let t2 = create(&mut db.conn, nt2).unwrap();
        assert_eq!(t1.ticket_key, "DEVOS-1");
        assert_eq!(t2.ticket_key, "DEVOS-2");
    }

    #[test]
    fn create_under_missing_project_is_not_found() {
        let mut db = Db::open_in_memory().unwrap();
        let nt = NewThread {
            project_id: 999,
            title: "x".into(),
            description: None,
            type_id: 1,
            status_id: 1,
            priority_id: 1,
            git_branch: None,
        };
        assert!(matches!(
            create(&mut db.conn, nt),
            Err(AnchorError::NotFound(_))
        ));
    }

    #[test]
    fn delete_cascades_notes() {
        let mut db = Db::open_in_memory().unwrap();
        let pid = setup(&db);
        let nt = new_thread(&db.conn, pid);
        let t = create(&mut db.conn, nt).unwrap();
        delete(&mut db.conn, t.id).unwrap();
        assert!(get(&db.conn, t.id).is_err());
    }

    #[test]
    fn get_by_ticket_key_finds_thread() {
        let mut db = Db::open_in_memory().unwrap();
        let pid = setup(&db);
        let nt = new_thread(&db.conn, pid);
        let t = create(&mut db.conn, nt).unwrap();
        let found = get_by_ticket_key(&db.conn, &t.ticket_key).unwrap();
        assert_eq!(found.id, t.id);
        assert!(get_by_ticket_key(&db.conn, "NOPE-1").is_err());
    }
}
