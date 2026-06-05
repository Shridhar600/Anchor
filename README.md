<div align="center">
  <img src="assets/anchor-icon.png" width="120" alt="Anchor" />
  <h1>Anchor ⚓</h1>
  <p><strong>A local-first home for your dev projects — and the context your AI tools keep losing.</strong></p>
</div>

---

Anchor tracks your projects, their **threads** (tickets), an **append-only note log**, and
linked **resources** — so you *and* your AI coding tools can always pick up exactly where you
left off, instead of digging back through old chat sessions.

It’s built for the way you actually work now: lots of side-projects, lots of AI-assisted
sessions, and a constant struggle to remember *what* you were doing and *why*. Anchor keeps
that thread — pinned to real local state (git branch, repo path, file refs).

> **Why not Notion/Linear?** Those are built for teams and live in the cloud. Anchor is
> local-first and built so your **AI tools can read and write it** (a CLI today, an MCP server
> next) and so every thread is tied to your actual repo. That’s the part a generic doc tool
> structurally can’t do.

<div align="center">
  <img src="assets/board.png" width="860" alt="Anchor board" />
  <br/><em>The board — threads grouped by status, with a detail panel that pins “where you left off.”</em>
</div>

## Highlights

- **Kanban board** of threads per project (backlog → todo → in progress → blocked → done).
- **Append-only note log** per thread — `log` / `checkpoint` / `decision` entries. The latest
  *checkpoint* is pinned as “where I left off.” History is the product; nothing is overwritten.
- **Resources** — attach links, files, and folders (native pickers) to a project or thread.
- **Tied to local state** — repo path opens in your file manager, git remote opens in the
  browser, current branch shown inline.
- **Command palette** (⌘K), keyboard-driven, calm dark-first UI.
- **A real CLI** (`anchor`) over the same data — scriptable, `--json` output, audit log — so
  agents and scripts can drive it.
- **100% local.** SQLite on disk. No cloud, no account, no telemetry.

## Status

**Early, open source (MIT), macOS-first.** v1 focuses on the desktop app + CLI on macOS;
cross-platform window chrome is in place (Windows/Linux frameless controls) but less battle-tested.
See [CHANGELOG.md](CHANGELOG.md).

## Architecture

A Cargo workspace + a Tauri v2 desktop app:

- **`anchor-core`** — Rust library, the data layer: SQLite (`rusqlite`) with versioned migrations
  and a repository layer that enforces integrity in code (no DB-level foreign keys), with atomic
  per-project ticket-key generation (`ANCHOR-1`, `ANCHOR-2`, …).
- **`anchor-cli`** — the `anchor` binary: project / thread / note / resource commands, global
  `--json`, and an append-only command audit log.
- **`src-tauri` + `src/`** — the desktop app: Rust backend (Tauri commands over `anchor-core`) +
  a React + TypeScript frontend.

## Build & run

Requires a [Rust toolchain](https://rustup.rs/) and [pnpm](https://pnpm.io/).

```sh
# clone, then:
pnpm install

# desktop app (dev)
pnpm tauri dev

# CLI
cargo install --path anchor-cli   # → `anchor` on your PATH
```

## CLI quickstart

```sh
anchor project add --key ANCHOR --name "Anchor" \
  --path /path/to/repo --remote github.com/you/repo

anchor thread add --project ANCHOR --title "Wire up the MCP server" \
  --type feature --status todo --priority high

anchor note add --thread ANCHOR-1 --kind checkpoint \
  --body "Stubbed the server; next: list_threads + append_note."

anchor thread list --project ANCHOR        # the board, grouped by status
anchor thread show ANCHOR-1                 # detail + note log
anchor thread move ANCHOR-1 --status in_progress
```

Add `--json` to any command for machine-readable output (handy for agents), and `--actor <name>`
to attribute changes in the audit log.

## Contributing

Contributions are welcome — issues and pull requests. See [CONTRIBUTING.md](CONTRIBUTING.md)
for local development and the workflow. For anything non-trivial, open an issue first to
discuss the approach.

## License

[MIT](LICENSE) © 2026 Shridhar600. Free to use, modify, and distribute.
