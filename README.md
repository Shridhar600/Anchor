# Anchor ⚓

Local-first project & work-thread tracker for AI-assisted development.

Anchor lets you track projects, threads (tickets), linked resources, and an
append-only note log — so you *and* your AI coding tools can always pick up
exactly where you left off. The goal: stop losing the thread of what you were
building or thinking about across sessions.

## Status

Early development, but usable today via the CLI:

- **`anchor-core`** — data layer: SQLite storage, versioned migrations, repository
  layer with referential integrity. Done, tested.
- **`anchor` CLI** — manage projects, threads, notes, and resources from the
  terminal (and from AI tools). Done, tested.
- **Planned** — Tauri desktop app with a Kanban board, and an MCP server so AI
  coding tools can create projects, open threads, and log checkpoints automatically.

## Install

Requires a Rust toolchain ([rustup](https://rustup.rs/)).

```sh
git clone https://github.com/Shridhar600/Anchor.git
cd Anchor
cargo install --path anchor-cli   # installs `anchor` to ~/.cargo/bin
```

Make sure `~/.cargo/bin` is on your `PATH`. The database is created automatically
in your OS app-data directory on first use; override with `--db <path>` or the
`ANCHOR_DB` environment variable.

## Quickstart

```sh
# Create a project (its key prefixes ticket numbers, e.g. ANCHOR-1)
anchor project add --key ANCHOR --name "Anchor" \
  --path /path/to/repo --remote github.com/you/repo

# Open a thread
anchor thread add --project ANCHOR --title "Add MCP server" \
  --type feature --status todo --priority high

# See the board, grouped by status
anchor thread list --project ANCHOR

# Log a checkpoint — "where I left off"
anchor note add --thread ANCHOR-1 --kind checkpoint \
  --body "Stubbed the server; next: wire up the tools."

# Move a thread, inspect it, attach a resource
anchor thread move ANCHOR-1 --status in_progress
anchor thread show ANCHOR-1
anchor resource add --project ANCHOR --type url --label "Design doc" --value https://...
```

Add `--json` to any command for machine-readable output (handy for AI tools), and
`--actor <name>` to attribute changes in the audit log.

## Architecture

- **Core** — `anchor-core`, a Rust library: SQLite (`rusqlite`) with versioned
  migrations and a repository layer that enforces integrity (no DB-level foreign
  keys; cascade/orphan rules and atomic ticket-key generation live in code).
- **CLI** — `anchor-cli`, a thin binary over the core. Every mutation is recorded
  in an append-only audit log.
- **Desktop app** (planned) — [Tauri](https://tauri.app/) (Rust backend + web UI).
  Fully local, no cloud sync.

## Tech Stack

Rust · SQLite (`rusqlite` + `rusqlite_migration`) · clap · Tauri (later) · TypeScript (UI, later).

## License

Open source planned. License TBD.
