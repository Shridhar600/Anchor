# Anchor ⚓

Local-first project & work-thread tracker for AI-assisted development.

Anchor lets you track projects, threads (tickets), linked resources, and an
append-only note log — so you *and* your AI coding tools can always pick up
exactly where you left off. The goal: stop losing the thread of what you were
building or thinking about across sessions.

## Status

Early development. Current focus: the data layer (`anchor-core`).

## Architecture

- **Desktop app** — [Tauri](https://tauri.app/) (Rust backend + web UI). Fully local, no cloud sync.
- **Core** — `anchor-core`, a Rust library: SQLite storage with a repository layer.
- **Planned** — Kanban board UI, and an MCP/CLI surface so AI coding tools can
  create projects, open threads, and log checkpoints automatically.

## Tech Stack

Rust · SQLite (`rusqlite`) · Tauri · TypeScript (UI, later).

## License

Open source planned. License TBD.
