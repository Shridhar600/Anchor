use std::fs;
use std::path::Path;

/// Read the current git branch for `local_path` by parsing `<path>/.git/HEAD`.
///
/// - `ref: refs/heads/<branch>` → returns `branch`.
/// - Detached HEAD (raw 40-char sha) → returns the short sha (first 7 chars),
///   or the full sha if shorter than 7.
/// - Anything else (missing file, non-git dir, no read permission, etc.) → `""`.
///
/// Uses std fs only; no new dependencies.
pub fn current_branch(local_path: &str) -> String {
    if local_path.is_empty() {
        return String::new();
    }
    let head_path = Path::new(local_path).join(".git").join("HEAD");
    let Ok(content) = fs::read_to_string(&head_path) else {
        return String::new();
    };
    let trimmed = content.trim();
    if let Some(rest) = trimmed.strip_prefix("ref: refs/heads/") {
        return rest.trim().to_string();
    }
    if !trimmed.is_empty() && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return short_sha(trimmed);
    }
    String::new()
}

fn short_sha(sha: &str) -> String {
    if sha.len() <= 7 {
        sha.to_string()
    } else {
        sha[..7].to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    struct TempDir(PathBuf);
    impl TempDir {
        fn new(label: &str) -> Self {
            let mut p = std::env::temp_dir();
            p.push(format!(
                "anchor-core-git-test-{label}-{}",
                std::process::id()
            ));
            let _ = fs::remove_dir_all(&p);
            fs::create_dir_all(&p).unwrap();
            TempDir(p)
        }
        fn path(&self) -> &Path {
            &self.0
        }
    }
    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn write_git_head(root: &Path, head: &str) {
        let git = root.join(".git");
        fs::create_dir_all(&git).unwrap();
        fs::write(git.join("HEAD"), head).unwrap();
    }

    #[test]
    fn returns_branch_name_for_typical_head() {
        let tmp = TempDir::new("branch");
        write_git_head(tmp.path(), "ref: refs/heads/feat/ui\n");
        assert_eq!(current_branch(tmp.path().to_str().unwrap()), "feat/ui");
    }

    #[test]
    fn returns_branch_name_without_trailing_newline() {
        let tmp = TempDir::new("branch-no-newline");
        write_git_head(tmp.path(), "ref: refs/heads/main");
        assert_eq!(current_branch(tmp.path().to_str().unwrap()), "main");
    }

    #[test]
    fn returns_short_sha_for_detached_head() {
        let tmp = TempDir::new("detached");
        let sha = "a1b2c3d4e5f60718293a4b5c6d7e8f900a1b2c3d4";
        write_git_head(tmp.path(), sha);
        assert_eq!(current_branch(tmp.path().to_str().unwrap()), "a1b2c3d");
    }

    #[test]
    fn returns_full_sha_when_shorter_than_7() {
        let tmp = TempDir::new("short-sha");
        write_git_head(tmp.path(), "abc");
        assert_eq!(current_branch(tmp.path().to_str().unwrap()), "abc");
    }

    #[test]
    fn returns_empty_for_missing_git_dir() {
        let tmp = TempDir::new("no-git");
        assert_eq!(current_branch(tmp.path().to_str().unwrap()), "");
    }

    #[test]
    fn returns_empty_for_empty_path() {
        assert_eq!(current_branch(""), "");
    }

    #[test]
    fn returns_empty_for_unrecognized_head_content() {
        let tmp = TempDir::new("weird");
        write_git_head(tmp.path(), "this is not git output");
        assert_eq!(current_branch(tmp.path().to_str().unwrap()), "");
    }
}
