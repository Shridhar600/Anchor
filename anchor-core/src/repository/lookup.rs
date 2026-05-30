use crate::error::{AnchorError, Result};
use crate::models::LookupRow;
use rusqlite::Connection;

fn list(conn: &Connection, table: &str) -> Result<Vec<LookupRow>> {
    let sql = format!("SELECT id, key, label FROM {table} ORDER BY id");
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], |r| {
        Ok(LookupRow {
            id: r.get(0)?,
            key: r.get(1)?,
            label: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// List seeded thread type lookup rows.
pub fn thread_types(conn: &Connection) -> Result<Vec<LookupRow>> {
    list(conn, "thread_types")
}
/// List seeded priority lookup rows.
pub fn priorities(conn: &Connection) -> Result<Vec<LookupRow>> {
    list(conn, "priorities")
}
/// List seeded resource type lookup rows.
pub fn resource_types(conn: &Connection) -> Result<Vec<LookupRow>> {
    list(conn, "resource_types")
}
/// List seeded note kind lookup rows.
pub fn note_kinds(conn: &Connection) -> Result<Vec<LookupRow>> {
    list(conn, "note_kinds")
}

/// List global statuses (those not scoped to a specific project).
pub fn global_statuses(conn: &Connection) -> Result<Vec<LookupRow>> {
    let mut stmt = conn.prepare(
        "SELECT id, key, label FROM statuses WHERE project_id IS NULL ORDER BY \"order\"",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(LookupRow {
            id: r.get(0)?,
            key: r.get(1)?,
            label: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

/// Resolve a lookup key to its numeric id.
pub fn id_for_key(conn: &Connection, table: &str, key: &str) -> Result<i64> {
    let sql = format!("SELECT id FROM {table} WHERE key = ?1");
    conn.query_row(&sql, [key], |r| r.get(0))
        .map_err(|_| AnchorError::NotFound(format!("{table} key '{key}'")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn lists_seeded_thread_types() {
        let db = Db::open_in_memory().unwrap();
        let types = thread_types(&db.conn).unwrap();
        assert_eq!(types.len(), 5);
        assert_eq!(types[0].key, "feature");
    }

    #[test]
    fn resolves_status_key_to_id() {
        let db = Db::open_in_memory().unwrap();
        let id = id_for_key(&db.conn, "statuses", "todo").unwrap();
        assert!(id > 0);
        assert!(id_for_key(&db.conn, "statuses", "nope").is_err());
    }
}
