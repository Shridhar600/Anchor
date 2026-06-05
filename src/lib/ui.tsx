// Shared presentational helpers + the Icon shim. Ported from the prototype's
// helpers.jsx; lucide is now the bundled `lucide-react` (no CDN / no network).

import { icons as LUCIDE } from "lucide-react";
import type { CSSProperties } from "react";
import type {
  NoteAuthor,
  Note,
  Priority,
  Thread,
  ThreadStatus,
  ThreadType,
} from "./types";
import { AUTHOR_META, COLUMNS, PRIORITY_META, TYPE_META } from "./meta";

export const STATUS_COLOR: Record<string, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.id, c.color]),
);
export const TYPE_TONE = Object.fromEntries(
  (Object.entries(TYPE_META) as [ThreadType, { tone: string }][]).map(
    ([k, v]) => [k, v.tone],
  ),
) as Record<ThreadType, string>;

// Soft tint: translucent background + solid foreground in the given tone.
export function toneBg(tone: string, pct = 15): CSSProperties {
  return {
    background: `color-mix(in srgb, ${tone} ${pct}%, transparent)`,
    color: tone,
  };
}

export function statusLabel(id: ThreadStatus): string {
  return COLUMNS.find((c) => c.id === id)?.label ?? id;
}

// Relative time from the real clock.
export function fmtTime(iso: string): string {
  const then = new Date(iso);
  const mins = Math.round((Date.now() - then.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

// kebab-case ("folder-git-2") -> PascalCase ("FolderGit2"), the key lucide uses.
const _pascalCache: Record<string, string> = {};
function pascal(name: string): string {
  if (_pascalCache[name]) return _pascalCache[name];
  const p = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  _pascalCache[name] = p;
  return p;
}

// Icons are bundled statically (lucide's `icons` record) so they render
// synchronously with no per-icon lazy chunk / pop-in. The icon set is bounded
// (component icons + enum meta + the curated project-icon picker).
export function Icon({
  name,
  size = "1em",
  style,
  className,
  strokeWidth = 1.8,
}: {
  name: string;
  size?: number | string;
  style?: CSSProperties;
  className?: string;
  strokeWidth?: number;
}) {
  const Cmp = LUCIDE[pascal(name) as keyof typeof LUCIDE];
  if (!Cmp) {
    if (import.meta.env.DEV) console.warn(`[Icon] unknown icon: ${name}`);
    return null;
  }
  return (
    <Cmp
      size={size}
      style={style}
      className={className}
      strokeWidth={strokeWidth}
    />
  );
}

export function ColDot({ status }: { status: ThreadStatus }) {
  return (
    <span className="col-dot" style={{ background: STATUS_COLOR[status] }} />
  );
}

export function TypeIcon({ type }: { type: ThreadType; size?: number }) {
  const meta = TYPE_META[type];
  return (
    <span className="card-type" style={toneBg(TYPE_TONE[type])}>
      <Icon name={meta.icon} size={12.5} />
    </span>
  );
}

export function PrioBars({ priority }: { priority: Priority }) {
  const rank = PRIORITY_META[priority].rank; // 1..3
  return (
    <span
      className={`card-prio ${priority}`}
      title={`Priority: ${PRIORITY_META[priority].label}`}
    >
      {[0, 1, 2].map((i) => (
        <i
          key={i}
          className={i < rank ? "on" : ""}
          style={{ height: `${6 + i * 3}px` }}
        />
      ))}
    </span>
  );
}

export function AuthorBadge({ author }: { author: NoteAuthor }) {
  const meta = AUTHOR_META[author] || AUTHOR_META.user;
  return (
    <span className="author-badge">
      <span className={`dotav ${author}`}>
        {meta.icon ? <Icon name={meta.icon} size={10} /> : meta.avatar}
      </span>
      {meta.label}
    </span>
  );
}

// Latest checkpoint note for a thread, or null.
export function latestCheckpoint(thread: Thread): Note | null {
  const ck = thread.notes.filter((n) => n.kind === "checkpoint");
  if (!ck.length) return null;
  return ck
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
}
