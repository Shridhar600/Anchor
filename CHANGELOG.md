# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Unreleased

### Added

- **Data layer (`anchor-core`):** SQLite storage with versioned migrations, repository
  layer enforcing referential integrity in code, and atomic ticket-key generation
  (`<project-key>-<n>`) via per-project thread counters inside transactions.
- **CLI (`anchor`):** Commands for projects (`add`, `list`, `show`), threads
  (`add`, `list`, `move`, `show`), notes (`add`), and resources (`add`). Global
  `--json` output, `--actor` / `--db` resolution, and an audit log (`command_log`)
  recording every mutation.
- **Desktop app (Tauri v2 + React/TypeScript):** Kanban board view, thread detail
  with append-only note log, command palette, settings pane, and native/cross-platform
  window chrome.
