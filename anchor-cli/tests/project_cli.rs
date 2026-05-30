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
fn project_add_then_list_shows_it() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);

    anchor(&db)
        .args(["project", "add", "--key", "DEVOS", "--name", "Anchor"])
        .assert()
        .success();

    let assert = anchor(&db).args(["project", "list"]).assert().success();
    let out = String::from_utf8_lossy(&assert.get_output().stdout).into_owned();
    assert!(out.contains("DEVOS"), "list output: {out}");
    assert!(out.contains("Anchor"), "list output: {out}");
}

#[test]
fn project_add_json_emits_valid_json() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);

    let assert = anchor(&db)
        .args([
            "--json", "project", "add", "--key", "DEVOS", "--name", "Anchor",
        ])
        .assert()
        .success();
    let out = String::from_utf8_lossy(&assert.get_output().stdout).into_owned();
    let v: serde_json::Value = serde_json::from_str(&out).expect("valid json");
    assert_eq!(v["key"], "DEVOS");
    assert_eq!(v["status"], "active");
}

#[test]
fn project_show_missing_exits_2() {
    let dir = tempdir().unwrap();
    let db = db_path(&dir);
    anchor(&db)
        .args(["project", "show", "NOPE"])
        .assert()
        .code(2);
}
