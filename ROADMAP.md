# Roadmap

**Vision:** an **AI-agent-native project manager** — a local-first source of truth about your
dev work that *both* you and your AI tools read and write. Agents open threads, log decisions,
and resume context on their own; you stay in control. Anchor is early and actively evolving —
this is where it's headed.

> Status legend: ✅ shipped · 🔜 next · 🔭 later · 💭 idea

## ✅ Shipped
- **Data layer** (`anchor-core`) — SQLite, versioned migrations, repository-enforced integrity, atomic ticket keys.
- **CLI** (`anchor`) — projects, threads, notes, resources; `--json`; audit log. The scriptable agent surface.
- **Desktop app** (Tauri v2 + React) — board, thread detail + append-only note log, command palette, settings.
- **Cross-platform window chrome** — native macOS lights; custom controls on Windows/Linux.

## 🔜 Next — the agent-native core
- **MCP server** — so AI tools create projects, open threads, and log progress/checkpoints
  automatically, with no human in the loop. The CLI already proves the surface.
- **Agent skills** — ready-made skills/prompts so your agent knows how to drive Anchor out of the box.
- **Linked chat sessions** — link a thread to the agent chat session that produced it, and jump
  straight back into that exact conversation from Anchor.

## 🔭 Later
- **Dashboards** — at-a-glance views across projects: what's in progress, what's blocked, what's next.
- Richer board (drag-and-drop, filters, saved views) and full-text search across threads/notes.
- First-class git awareness — link threads to branches/commits/PRs, surface "what changed."
- Resource previews; quick-capture; keyboard-first flows.
- Windows/Linux polish and packaged releases.

## 💭 Ideas (unscheduled)
- Optional encrypted sync between your own machines (still no third-party cloud).
- Plugin hooks for other agent runtimes.
- Templates for recurring project/thread setups.

---

Have a use case or disagree with the priorities? Open an issue — see
[CONTRIBUTING.md](CONTRIBUTING.md).
