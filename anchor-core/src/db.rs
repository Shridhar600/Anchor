use crate::error::Result;
use crate::migrations::migrations;
use rusqlite::Connection;

/// An open SQLite database connection with migrations applied.
pub struct Db {
    pub conn: Connection,
}

impl Db {
    /// Open (or create) a database at `path` and run pending migrations.
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::init(conn)
    }

    /// Open an in-memory database (for testing).
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::init(conn)
    }

    fn init(mut conn: Connection) -> Result<Self> {
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "busy_timeout", 5000)?;
        conn.pragma_update(None, "temp_store", "MEMORY")?;
        migrations().to_latest(&mut conn)?;
        Ok(Db { conn })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn open_in_memory_runs_migrations_and_seeds() {
        let db = Db::open_in_memory().unwrap();
        let n: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM statuses", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 5);
    }
}
