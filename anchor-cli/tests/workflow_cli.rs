use assert_cmd::Command;
use tempfile::tempdir;

fn db_path(dir: &tempfile::TempDir) -> String {
    dir.path().join("anchor.db").to_string_lossy().into_owned()
}

#[allow(deprecated)]
fn anchor(db: &str) -> Command {
    let mut c = Command::cargo_bin("anchor").unwrap();
    c.args(["--db", db]);
    c
}

#[test]
fn full_loop_project_thread_note_show() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);

    anchor(&db)
        .args(["project", "add", "--key", "DEVOS", "--name", "Anchor"])
        .assert()
        .success();

    let assert = anchor(&db)
        .args([
            "--json",
            "thread",
            "add",
            "--project",
            "DEVOS",
            "--title",
            "Architect backend",
            "--type",
            "idea",
            "--status",
            "in_progress",
            "--priority",
            "high",
        ])
        .assert()
        .success();
    let out = String::from_utf8_lossy(&assert.get_output().stdout).into_owned();
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    let ticket = v["ticket_key"].as_str().unwrap().to_string();
    assert_eq!(ticket, "DEVOS-1");

    anchor(&db)
        .args([
            "--actor",
            "claude-code",
            "note",
            "add",
            "--thread",
            &ticket,
            "--kind",
            "checkpoint",
            "--body",
            "left off: wiring db",
        ])
        .assert()
        .success();

    let assert = anchor(&db)
        .args(["thread", "show", &ticket])
        .assert()
        .success();
    let out = String::from_utf8_lossy(&assert.get_output().stdout).into_owned();
    assert!(out.contains("left off: wiring db"), "show: {out}");
    assert!(out.contains("claude-code"), "show: {out}");

    let assert = anchor(&db)
        .args(["project", "show", "DEVOS"])
        .assert()
        .success();
    let out = String::from_utf8_lossy(&assert.get_output().stdout).into_owned();
    assert!(out.contains("DEVOS-1"), "project show: {out}");
}

#[test]
fn thread_move_updates_status() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);
    anchor(&db)
        .args(["project", "add", "--key", "DEVOS", "--name", "Anchor"])
        .assert()
        .success();
    anchor(&db)
        .args(["thread", "add", "--project", "DEVOS", "--title", "x"])
        .assert()
        .success();
    anchor(&db)
        .args(["thread", "move", "DEVOS-1", "--status", "done"])
        .assert()
        .success();
    let assert = anchor(&db)
        .args(["thread", "show", "DEVOS-1"])
        .assert()
        .success();
    let out = String::from_utf8_lossy(&assert.get_output().stdout).into_owned();
    assert!(out.contains("status: Done"), "show: {out}");
}

#[test]
fn resource_attached_to_project_shows_in_project() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);
    anchor(&db)
        .args(["project", "add", "--key", "DEVOS", "--name", "Anchor"])
        .assert()
        .success();
    anchor(&db)
        .args([
            "resource",
            "add",
            "--project",
            "DEVOS",
            "--type",
            "url",
            "--label",
            "spec",
            "--value",
            "http://x",
        ])
        .assert()
        .success();
    let assert = anchor(&db)
        .args(["project", "show", "DEVOS"])
        .assert()
        .success();
    let out = String::from_utf8_lossy(&assert.get_output().stdout).into_owned();
    assert!(out.contains("spec"), "project show: {out}");
}

#[test]
fn note_add_to_missing_thread_exits_2() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);
    anchor(&db)
        .args(["note", "add", "--thread", "NOPE-1", "--body", "x"])
        .assert()
        .code(2);
}

#[test]
fn thread_add_unknown_type_exits_2() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);
    anchor(&db)
        .args(["project", "add", "--key", "DEVOS", "--name", "Anchor"])
        .assert()
        .success();
    anchor(&db)
        .args([
            "thread",
            "add",
            "--project",
            "DEVOS",
            "--title",
            "x",
            "--type",
            "bogus",
        ])
        .assert()
        .code(2);
}
