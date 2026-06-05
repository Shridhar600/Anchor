use crate::error::Result;
use rusqlite::{Connection, OptionalExtension};

/// Default actor identity returned when no value is persisted.
pub const DEFAULT_ACTOR: &str = "user";

const KEY_ACTOR: &str = "actor";

/// Read a settings value by key. Returns `None` if the key is not set.
pub fn get(conn: &Connection, key: &str) -> Result<Option<String>> {
    let v: Option<String> = conn
        .query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| {
            r.get(0)
        })
        .optional()?;
    Ok(v)
}

/// Persist a settings value, replacing any existing one.
pub fn set(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

/// Read the current actor. Falls back to [`DEFAULT_ACTOR`] when unset.
pub fn actor(conn: &Connection) -> Result<String> {
    Ok(get(conn, KEY_ACTOR)?
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_ACTOR.to_string()))
}

/// Persist the current actor.
pub fn set_actor(conn: &Connection, actor: &str) -> Result<()> {
    set(conn, KEY_ACTOR, actor)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Db;

    #[test]
    fn get_missing_returns_none() {
        let db = Db::open_in_memory().unwrap();
        assert!(get(&db.conn, "nope").unwrap().is_none());
    }

    #[test]
    fn set_then_get_round_trips() {
        let db = Db::open_in_memory().unwrap();
        set(&db.conn, "theme", "dark").unwrap();
        assert_eq!(get(&db.conn, "theme").unwrap().as_deref(), Some("dark"));
    }

    #[test]
    fn set_overwrites_existing_value() {
        let db = Db::open_in_memory().unwrap();
        set(&db.conn, "k", "one").unwrap();
        set(&db.conn, "k", "two").unwrap();
        assert_eq!(get(&db.conn, "k").unwrap().as_deref(), Some("two"));
    }

    #[test]
    fn actor_defaults_to_user_when_unset() {
        let db = Db::open_in_memory().unwrap();
        assert_eq!(actor(&db.conn).unwrap(), "user");
    }

    #[test]
    fn actor_persists_via_set_actor() {
        let db = Db::open_in_memory().unwrap();
        set_actor(&db.conn, "claude-code").unwrap();
        assert_eq!(actor(&db.conn).unwrap(), "claude-code");
    }

    #[test]
    fn empty_actor_falls_back_to_default() {
        let db = Db::open_in_memory().unwrap();
        set_actor(&db.conn, "").unwrap();
        assert_eq!(actor(&db.conn).unwrap(), "user");
    }
}
