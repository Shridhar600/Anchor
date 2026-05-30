use crate::error::Result;
use crate::models::CommandLogEntry;
use rusqlite::Connection;

pub struct NewLogEntry {
    pub actor: String,
    pub command: String,
    pub target_type: Option<String>,
    pub target_id: Option<String>,
    pub summary: String,
}

fn map_row(r: &rusqlite::Row) -> rusqlite::Result<CommandLogEntry> {
    Ok(CommandLogEntry {
        id: r.get("id")?,
        ts: r.get("ts")?,
        actor: r.get("actor")?,
        command: r.get("command")?,
        target_type: r.get("target_type")?,
        target_id: r.get("target_id")?,
        summary: r.get("summary")?,
    })
}

/// Insert one audit-log row. Called by the CLI after a successful mutating command.
pub fn record(conn: &Connection, e: NewLogEntry) -> Result<()> {
    conn.execute(
        "INSERT INTO command_log (ts, actor, command, target_type, target_id, summary)
         VALUES (strftime('%Y-%m-%dT%H:%M:%SZ','now'), ?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![e.actor, e.command, e.target_type, e.target_id, e.summary],
    )?;
    Ok(())
}

/// Most recent entries first (for a future activity feed; used by tests now).
pub fn recent(conn: &Connection, limit: i64) -> Result<Vec<CommandLogEntry>> {
    let mut stmt = conn.prepare("SELECT * FROM command_log ORDER BY ts DESC, id DESC LIMIT ?1")?;
    let rows = stmt.query_map([limit], map_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn record_then_recent_returns_entry() {
        let db = Db::open_in_memory().unwrap();
        record(
            &db.conn,
            NewLogEntry {
                actor: "claude-code".into(),
                command: "thread.add".into(),
                target_type: Some("thread".into()),
                target_id: Some("DEVOS-1".into()),
                summary: "DEVOS-1 created".into(),
            },
        )
        .unwrap();
        let rows = recent(&db.conn, 10).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].command, "thread.add");
        assert_eq!(rows[0].target_id.as_deref(), Some("DEVOS-1"));
    }
}
