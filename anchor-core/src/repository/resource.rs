use crate::error::{AnchorError, Result};
use crate::models::Resource;
use rusqlite::{Connection, OptionalExtension};

/// Input for creating a new resource.
pub struct NewResource {
    pub project_id: i64,
    pub thread_id: Option<i64>,
    pub type_id: i64,
    pub label: String,
    pub value: String,
}

fn map_row(r: &rusqlite::Row) -> rusqlite::Result<Resource> {
    Ok(Resource {
        id: r.get("id")?,
        project_id: r.get("project_id")?,
        thread_id: r.get("thread_id")?,
        type_id: r.get("type_id")?,
        label: r.get("label")?,
        value: r.get("value")?,
        created_at: r.get("created_at")?,
    })
}

/// Add a resource (atomic: guards + insert in an IMMEDIATE transaction).
pub fn add(conn: &mut Connection, res: NewResource) -> Result<Resource> {
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let proj: Option<i64> = tx
        .query_row(
            "SELECT id FROM projects WHERE id=?1",
            [res.project_id],
            |r| r.get(0),
        )
        .optional()?;
    if proj.is_none() {
        return Err(AnchorError::NotFound(format!("project {}", res.project_id)));
    }
    if let Some(tid) = res.thread_id {
        let ok: Option<i64> = tx
            .query_row(
                "SELECT id FROM threads WHERE id=?1 AND project_id=?2",
                rusqlite::params![tid, res.project_id],
                |r| r.get(0),
            )
            .optional()?;
        if ok.is_none() {
            return Err(AnchorError::Invalid(format!(
                "thread {tid} not in project {}",
                res.project_id
            )));
        }
    }
    tx.execute(
        "INSERT INTO resources (project_id, thread_id, type_id, label, value, created_at)
         VALUES (?1,?2,?3,?4,?5, strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        rusqlite::params![
            res.project_id,
            res.thread_id,
            res.type_id,
            res.label,
            res.value
        ],
    )?;
    let id = tx.last_insert_rowid();
    let r = tx.query_row("SELECT * FROM resources WHERE id=?1", [id], map_row)?;
    tx.commit()?;
    Ok(r)
}

/// Only resources attached directly to a thread.
pub fn list_by_thread(conn: &Connection, thread_id: i64) -> Result<Vec<Resource>> {
    let mut stmt =
        conn.prepare("SELECT * FROM resources WHERE thread_id=?1 ORDER BY created_at")?;
    let rows = stmt.query_map([thread_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// All resources for a project (project-level and thread-scoped).
pub fn list_by_project(conn: &Connection, project_id: i64) -> Result<Vec<Resource>> {
    let mut stmt =
        conn.prepare("SELECT * FROM resources WHERE project_id=?1 ORDER BY created_at")?;
    let rows = stmt.query_map([project_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Delete a resource by id. Returns `NotFound` if it doesn't exist.
pub fn delete(conn: &Connection, id: i64) -> Result<()> {
    let n = conn.execute("DELETE FROM resources WHERE id=?1", [id])?;
    if n == 0 {
        return Err(AnchorError::NotFound(format!("resource {id}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use crate::models::ProjectStatus;
    use crate::repository::{lookup, project, thread};

    fn setup(db: &mut Db) -> (i64, i64) {
        let pid = project::create(
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
        .id;
        let type_id = lookup::id_for_key(&db.conn, "thread_types", "feature").unwrap();
        let status_id = lookup::id_for_key(&db.conn, "statuses", "todo").unwrap();
        let priority_id = lookup::id_for_key(&db.conn, "priorities", "med").unwrap();
        let tid = thread::create(
            &mut db.conn,
            thread::NewThread {
                project_id: pid,
                title: "t".into(),
                description: None,
                type_id,
                status_id,
                priority_id,
                git_branch: None,
            },
        )
        .unwrap()
        .id;
        (pid, tid)
    }

    #[test]
    fn project_view_aggregates_thread_and_project_resources() {
        let mut db = Db::open_in_memory().unwrap();
        let (pid, tid) = setup(&mut db);
        let url = lookup::id_for_key(&db.conn, "resource_types", "url").unwrap();
        add(
            &mut db.conn,
            NewResource {
                project_id: pid,
                thread_id: None,
                type_id: url,
                label: "spec".into(),
                value: "http://x".into(),
            },
        )
        .unwrap();
        add(
            &mut db.conn,
            NewResource {
                project_id: pid,
                thread_id: Some(tid),
                type_id: url,
                label: "pr".into(),
                value: "http://y".into(),
            },
        )
        .unwrap();
        assert_eq!(list_by_project(&db.conn, pid).unwrap().len(), 2);
        assert_eq!(list_by_thread(&db.conn, tid).unwrap().len(), 1);
    }

    #[test]
    fn thread_resource_must_belong_to_project() {
        let mut db = Db::open_in_memory().unwrap();
        let (pid, _tid) = setup(&mut db);
        let url = lookup::id_for_key(&db.conn, "resource_types", "url").unwrap();
        let r = add(
            &mut db.conn,
            NewResource {
                project_id: pid,
                thread_id: Some(999),
                type_id: url,
                label: "x".into(),
                value: "z".into(),
            },
        );
        assert!(matches!(r, Err(AnchorError::Invalid(_))));
    }

    #[test]
    fn delete_existing_then_missing() {
        let mut db = Db::open_in_memory().unwrap();
        let (pid, _tid) = setup(&mut db);
        let url = lookup::id_for_key(&db.conn, "resource_types", "url").unwrap();
        let r = add(
            &mut db.conn,
            NewResource {
                project_id: pid,
                thread_id: None,
                type_id: url,
                label: "x".into(),
                value: "y".into(),
            },
        )
        .unwrap();
        delete(&db.conn, r.id).unwrap();
        assert!(matches!(
            delete(&db.conn, r.id),
            Err(AnchorError::NotFound(_))
        ));
    }
}
