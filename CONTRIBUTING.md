# Contributing

Anchor is open source under the **MIT License** (see `LICENSE`), and contributions are
welcome — bug reports, feature requests, and pull requests. This guide covers local
development and how to submit changes.

It's early days, so for anything non-trivial please **open an issue first** to discuss the
approach before sinking time into a PR.

## Prerequisites

- Rust toolchain (latest stable via `rustup`)
- [pnpm](https://pnpm.io/installation)

## Repository layout

```
anchor-core/    — Rust library crate (data layer: SQLite, migrations, repositories)
anchor-cli/     — Rust binary crate (the `anchor` CLI)
src-tauri/      — Tauri v2 shell (Rust backend, `anchor-app` crate)
src/            — React/TypeScript frontend (desktop UI)
```

## Build & run

| Command                  | Description                    |
| ------------------------ | ------------------------------ |
| `cargo build`            | Build all Rust crates          |
| `cargo test`             | Run all tests (workspace)      |
| `pnpm install`           | Install frontend dependencies  |
| `pnpm build`             | Build the frontend             |
| `pnpm tauri dev`         | Run the desktop app in dev     |
| `cargo install --path anchor-cli` | Install the CLI binary  |

## Quality gates

Before merging, all of the following must pass:

- `cargo test` — all workspace tests
- `cargo clippy --all-targets -- -D warnings`
- `cargo fmt --check`
- `cargo audit`
- `pnpm build` — frontend compiles without errors

## Submitting changes

1. Fork the repo and create a branch off `main`.
2. Make your change — keep it focused; match the surrounding style.
3. Make sure all the **quality gates** above pass.
4. Open a pull request describing what changed and why.

## Licensing

By contributing, you agree that your contributions are licensed under the project's
MIT License (see `LICENSE`).
