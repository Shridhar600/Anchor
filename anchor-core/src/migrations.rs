use rusqlite_migration::{Migrations, M};

/// Return the ordered list of schema and seed migrations.
pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        // --- v1: schema ---
        M::up(
            r#"
            CREATE TABLE thread_types (
                id    INTEGER PRIMARY KEY,
                key   TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                "order" INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE statuses (
                id        INTEGER PRIMARY KEY,
                key       TEXT NOT NULL,
                label     TEXT NOT NULL,
                "order"   INTEGER NOT NULL DEFAULT 0,
                is_done   INTEGER NOT NULL DEFAULT 0,
                project_id INTEGER
            );
            CREATE UNIQUE INDEX idx_statuses_key_scope
                ON statuses(key, IFNULL(project_id, -1));
            CREATE INDEX idx_statuses_project ON statuses(project_id);

            CREATE TABLE priorities (
                id    INTEGER PRIMARY KEY,
                key   TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL,
                rank  INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE resource_types (
                id    INTEGER PRIMARY KEY,
                key   TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL
            );

            CREATE TABLE note_kinds (
                id    INTEGER PRIMARY KEY,
                key   TEXT NOT NULL UNIQUE,
                label TEXT NOT NULL
            );

            CREATE TABLE projects (
                id             INTEGER PRIMARY KEY,
                key            TEXT NOT NULL UNIQUE,
                name           TEXT NOT NULL,
                description    TEXT,
                local_path     TEXT,
                git_remote     TEXT,
                status         TEXT NOT NULL DEFAULT 'active',
                thread_counter INTEGER NOT NULL DEFAULT 0,
                created_at     TEXT NOT NULL,
                updated_at     TEXT NOT NULL
            );

            CREATE TABLE threads (
                id          INTEGER PRIMARY KEY,
                project_id  INTEGER NOT NULL,
                ticket_key  TEXT NOT NULL UNIQUE,
                title       TEXT NOT NULL,
                description TEXT,
                type_id     INTEGER NOT NULL,
                status_id   INTEGER NOT NULL,
                priority_id INTEGER NOT NULL,
                git_branch  TEXT,
                "order"     INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE INDEX idx_threads_project  ON threads(project_id);
            CREATE INDEX idx_threads_status   ON threads(status_id);
            CREATE INDEX idx_threads_type     ON threads(type_id);

            CREATE TABLE thread_notes (
                id          INTEGER PRIMARY KEY,
                thread_id   INTEGER NOT NULL,
                author      TEXT NOT NULL,
                author_name TEXT,
                kind_id     INTEGER NOT NULL,
                body        TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX idx_notes_thread ON thread_notes(thread_id);

            CREATE TABLE resources (
                id          INTEGER PRIMARY KEY,
                project_id  INTEGER NOT NULL,
                thread_id   INTEGER,
                type_id     INTEGER NOT NULL,
                label       TEXT NOT NULL,
                value       TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX idx_resources_project ON resources(project_id);
            CREATE INDEX idx_resources_thread  ON resources(thread_id);
        "#,
        ),
        // --- v2: seed lookup rows ---
        M::up(
            r#"
            INSERT INTO thread_types (key, label, "order") VALUES
                ('feature','Feature',1),('bug','Bug',2),('idea','Idea',3),
                ('chore','Chore',4),('decision','Decision',5);

            INSERT INTO statuses (key, label, "order", is_done, project_id) VALUES
                ('backlog','Backlog',1,0,NULL),('todo','To Do',2,0,NULL),
                ('in_progress','In Progress',3,0,NULL),('blocked','Blocked',4,0,NULL),
                ('done','Done',5,1,NULL);

            INSERT INTO priorities (key, label, rank) VALUES
                ('low','Low',1),('med','Medium',2),('high','High',3);

            INSERT INTO resource_types (key, label) VALUES
                ('file','File'),('url','URL'),('note','Note'),('doc','Doc');

            INSERT INTO note_kinds (key, label) VALUES
                ('log','Log'),('checkpoint','Checkpoint'),('decision','Decision');
        "#,
        ),
        // --- v3: command audit log ---
        M::up(
            r#"
            CREATE TABLE command_log (
                id          INTEGER PRIMARY KEY,
                ts          TEXT NOT NULL,
                actor       TEXT NOT NULL,
                command     TEXT NOT NULL,
                target_type TEXT,
                target_id   TEXT,
                summary     TEXT NOT NULL
            );
            CREATE INDEX idx_command_log_ts ON command_log(ts);
        "#,
        ),
        // --- v4: query-tuned indexes ---
        M::up(
            r#"
            DROP INDEX idx_command_log_ts;
            CREATE INDEX idx_command_log_ts_id ON command_log(ts DESC, id DESC);
            CREATE INDEX idx_threads_project_status_order ON threads(project_id, status_id, "order");
            CREATE INDEX idx_notes_thread_kind ON thread_notes(thread_id, kind_id);
        "#,
        ),
    ])
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn migrations_validate() {
        assert!(migrations().validate().is_ok());
    }
}
