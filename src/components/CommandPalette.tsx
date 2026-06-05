/* CommandPalette — ⌘K. Search threads, jump, create, move status. Keyboard-first. */
import { useState, useEffect, useMemo, useRef } from "react";
import { Icon, ColDot, statusLabel } from "../lib/ui";
import type { Thread, Project, ThreadStatus } from "../lib/types";
import type { COLUMNS } from "../lib/meta";

type Column = (typeof COLUMNS)[number];

type PaletteItem =
  | { type: "action"; icon: string; title: string; run: () => void }
  | { type: "project"; project: Project; title: string; run: () => void }
  | { type: "thread"; thread: Thread; title: string; run: () => void }
  | { type: "status"; col: Column; ticket: string; run: () => void };

export function CommandPalette({
  threads,
  projects,
  columns,
  onClose,
  onJump,
  onCreate,
  onOpenOverview,
  onMoveStatus,
}: {
  threads: Thread[];
  projects: Project[];
  columns: Column[];
  onClose: () => void;
  onJump: (ticket: string) => void;
  onCreate: () => void;
  onOpenOverview: (key: string) => void;
  onMoveStatus: (ticket: string, status: ThreadStatus) => void;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const query = q.trim().toLowerCase();

    if (moveFor) {
      return columns.map((c) => ({
        type: "status" as const,
        col: c,
        ticket: moveFor,
        run: () => onMoveStatus(moveFor, c.id),
      }));
    }

    const list: PaletteItem[] = [];
    if (!query || "new thread create".includes(query)) {
      list.push({ type: "action", icon: "plus", title: "New thread", run: () => onCreate() });
    }

    const projMatched = (projects || []).filter((p) => {
      if (!query) return true;
      return (p.key + " " + p.name + " " + (p.description || ""))
        .toLowerCase()
        .includes(query);
    });
    projMatched.forEach((p) => {
      list.push({
        type: "project",
        project: p,
        title: p.name,
        run: () => onOpenOverview(p.key),
      });
    });

    const matched = threads.filter((t) => {
      if (!query) return true;
      return (t.ticket + " " + t.title).toLowerCase().includes(query);
    });
    matched.forEach((t) => {
      list.push({
        type: "thread",
        thread: t,
        title: t.title,
        run: () => onJump(t.ticket),
      });
    });
    return list;
  }, [q, moveFor, threads, projects, columns, onCreate, onJump, onOpenOverview, onMoveStatus]);

  useEffect(() => {
    setSel(0);
  }, [q, moveFor]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[sel];
      if (it) it.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (moveFor) setMoveFor(null);
      else onClose();
    } else if (e.key === "Tab" && !moveFor) {
      const it = items[sel];
      if (it && it.type === "thread") {
        e.preventDefault();
        setMoveFor(it.thread.ticket);
        setQ("");
      }
    }
  };

  return (
    <div className="cp-scrim" onClick={onClose}>
      <div className="cp" onClick={(e) => e.stopPropagation()}>
        <div className="cp-input-row">
          {moveFor ? (
            <span className="cp-item-key" style={{ fontSize: "12px" }}>
              {moveFor} →
            </span>
          ) : (
            <Icon name="search" size={18} />
          )}
          <input
            ref={inputRef}
            className="cp-input"
            placeholder={moveFor ? "Move to status…" : "Search threads or jump to…"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
          />
          {moveFor ? (
            <span
              className="cp-hint"
              onClick={() => setMoveFor(null)}
              style={{ cursor: "pointer" }}
            >
              esc
            </span>
          ) : (
            <span className="cp-hint">⌘K</span>
          )}
        </div>

        <div className="cp-list">
          {items.length === 0 && <div className="cp-empty">No matches</div>}

          {!moveFor && items.some((i) => i.type === "action") && (
            <div className="cp-group-label">Actions</div>
          )}
          {items.map((it, i) => {
            if (it.type !== "action") return null;
            return (
              <button
                key={"a" + i}
                className={"cp-item" + (sel === i ? " is-sel" : "")}
                onMouseEnter={() => setSel(i)}
                onClick={it.run}
              >
                <span className="cp-ic">
                  <Icon name={it.icon} size={16} />
                </span>
                <span className="cp-item-title">{it.title}</span>
              </button>
            );
          })}

          {!moveFor && items.some((i) => i.type === "project") && (
            <div className="cp-group-label">Project overview</div>
          )}
          {items.map((it, i) => {
            if (it.type !== "project") return null;
            const p = it.project;
            return (
              <button
                key={"p" + i}
                className={"cp-item" + (sel === i ? " is-sel" : "")}
                onMouseEnter={() => setSel(i)}
                onClick={it.run}
              >
                <span className="cp-ic">
                  <Icon name="layout-dashboard" size={16} />
                </span>
                <span className="cp-item-title">{p.name}</span>
                <span className="cp-item-meta">{p.key}</span>
              </button>
            );
          })}

          {!moveFor && items.some((i) => i.type === "thread") && (
            <div className="cp-group-label">Threads</div>
          )}
          {items.map((it, i) => {
            if (it.type !== "thread") return null;
            const t = it.thread;
            return (
              <button
                key={"t" + i}
                className={"cp-item" + (sel === i ? " is-sel" : "")}
                onMouseEnter={() => setSel(i)}
                onClick={it.run}
              >
                <span className="cp-item-key">{t.ticket}</span>
                <span className="cp-item-title">{t.title}</span>
                <span className="cp-item-meta">
                  <ColDot status={t.status} />
                  {statusLabel(t.status)}
                </span>
                {sel === i && <span className="cp-kbd">⇥ move</span>}
              </button>
            );
          })}

          {moveFor && <div className="cp-group-label">Move to</div>}
          {items.map((it, i) => {
            if (it.type !== "status") return null;
            return (
              <button
                key={"s" + i}
                className={"cp-item" + (sel === i ? " is-sel" : "")}
                onMouseEnter={() => setSel(i)}
                onClick={it.run}
              >
                <span className="cp-ic">
                  <ColDot status={it.col.id} />
                </span>
                <span className="cp-item-title">{it.col.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
