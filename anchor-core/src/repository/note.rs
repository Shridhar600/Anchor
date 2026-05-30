use crate::error::{AnchorError, Result};
use crate::models::{NoteAuthor, ThreadNote};
use rusqlite::{Connection, OptionalExtension};

/// Input for creating a new thread note.
pub struct NewNote {
    pub thread_id: i64,
    pub author: NoteAuthor,
    pub author_name: Option<String>,
    pub kind_id: i64,
    pub body: String,
}

fn map_row(r: &rusqlite::Row) -> rusqlite::Result<ThreadNote> {
    Ok(ThreadNote {
        id: r.get("id")?,
        thread_id: r.get("thread_id")?,
        author: {
            let s: String = r.get("author")?;
            s.parse::<NoteAuthor>().map_err(|e| {
                rusqlite::Error::FromSqlConversionFailure(
                    0,
                    rusqlite::types::Type::Text,
                    Box::new(e),
                )
            })?
        },
        author_name: r.get("author_name")?,
        kind_id: r.get("kind_id")?,
        body: r.get("body")?,
        created_at: r.get("created_at")?,
    })
}

/// Add a note to a thread (atomic: guard + insert in an IMMEDIATE transaction).
pub fn add(conn: &mut Connection, n: NewNote) -> Result<ThreadNote> {
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let exists: Option<i64> = tx
        .query_row("SELECT id FROM threads WHERE id=?1", [n.thread_id], |r| {
            r.get(0)
        })
        .optional()?;
    if exists.is_none() {
        return Err(AnchorError::NotFound(format!("thread {}", n.thread_id)));
    }
    tx.execute(
        "INSERT INTO thread_notes (thread_id, author, author_name, kind_id, body, created_at)
         VALUES (?1,?2,?3,?4,?5, strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        rusqlite::params![
            n.thread_id,
            n.author.as_str(),
            n.author_name,
            n.kind_id,
            n.body
        ],
    )?;
    let id = tx.last_insert_rowid();
    let note = tx.query_row("SELECT * FROM thread_notes WHERE id=?1", [id], map_row)?;
    tx.commit()?;
    Ok(note)
}

/// List notes for a thread, newest first.
pub fn list_by_thread(conn: &Connection, thread_id: i64) -> Result<Vec<ThreadNote>> {
    let mut stmt = conn.prepare(
        "SELECT * FROM thread_notes WHERE thread_id=?1 ORDER BY created_at DESC, id DESC",
    )?;
    let rows = stmt.query_map([thread_id], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Latest note whose kind is 'checkpoint' — the "where I left off" entry.
pub fn latest_checkpoint(conn: &Connection, thread_id: i64) -> Result<Option<ThreadNote>> {
    conn.query_row(
        "SELECT n.* FROM thread_notes n
         JOIN note_kinds k ON k.id = n.kind_id
         WHERE n.thread_id=?1 AND k.key='checkpoint'
         ORDER BY n.created_at DESC, n.id DESC LIMIT 1",
        [thread_id],
        map_row,
    )
    .optional()
    .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;
    use crate::models::ProjectStatus;
    use crate::repository::{lookup, project, thread};

    fn setup_thread(db: &mut Db) -> i64 {
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
        thread::create(
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
        .id
    }

    #[test]
    fn add_and_list_orders_newest_first() {
        let mut db = Db::open_in_memory().unwrap();
        let tid = setup_thread(&mut db);
        let log = lookup::id_for_key(&db.conn, "note_kinds", "log").unwrap();
        add(
            &mut db.conn,
            NewNote {
                thread_id: tid,
                author: NoteAuthor::User,
                author_name: None,
                kind_id: log,
                body: "first".into(),
            },
        )
        .unwrap();
        add(
            &mut db.conn,
            NewNote {
                thread_id: tid,
                author: NoteAuthor::Agent,
                author_name: Some("claude-code".into()),
                kind_id: log,
                body: "second".into(),
            },
        )
        .unwrap();
        let notes = list_by_thread(&db.conn, tid).unwrap();
        assert_eq!(notes.len(), 2);
        assert_eq!(notes[0].body, "second");
    }

    #[test]
    fn latest_checkpoint_returns_most_recent_checkpoint() {
        let mut db = Db::open_in_memory().unwrap();
        let tid = setup_thread(&mut db);
        let cp = lookup::id_for_key(&db.conn, "note_kinds", "checkpoint").unwrap();
        add(
            &mut db.conn,
            NewNote {
                thread_id: tid,
                author: NoteAuthor::Agent,
                author_name: None,
                kind_id: cp,
                body: "left off: auth".into(),
            },
        )
        .unwrap();
        let latest = latest_checkpoint(&db.conn, tid).unwrap().unwrap();
        assert_eq!(latest.body, "left off: auth");
    }

    #[test]
    fn add_to_missing_thread_is_not_found() {
        let mut db = Db::open_in_memory().unwrap();
        let log = lookup::id_for_key(&db.conn, "note_kinds", "log").unwrap();
        assert!(matches!(
            add(
                &mut db.conn,
                NewNote {
                    thread_id: 999,
                    author: NoteAuthor::User,
                    author_name: None,
                    kind_id: log,
                    body: "x".into()
                }
            ),
            Err(AnchorError::NotFound(_))
        ));
    }

    #[test]
    fn latest_checkpoint_none_when_no_checkpoints() {
        let mut db = Db::open_in_memory().unwrap();
        let tid = setup_thread(&mut db);
        assert!(latest_checkpoint(&db.conn, tid).unwrap().is_none());
    }
}
