// Display metadata for the fixed enums — the single frontend source of truth for
// labels / icons / tones. Keyed by the backend enum key. (Ported from the
// prototype's data.jsx *_META; the seed PROJECTS/THREADS arrays are gone — data
// now comes from the backend via src/lib/api.ts.)

import type {
  NoteAuthor,
  Priority,
  ResourceType,
  ThreadStatus,
  ThreadType,
} from "./types";

export const COLUMNS: { id: ThreadStatus; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "var(--fg-3)" },
  { id: "todo", label: "Todo", color: "var(--accent)" },
  { id: "in_progress", label: "In progress", color: "var(--warning)" },
  { id: "blocked", label: "Blocked", color: "var(--error)" },
  { id: "done", label: "Done", color: "var(--success)" },
];

export const TYPE_META: Record<
  ThreadType,
  { label: string; icon: string; tone: string }
> = {
  feature: { label: "Feature", icon: "sparkles", tone: "var(--accent)" },
  bug: { label: "Bug", icon: "bug", tone: "var(--error)" },
  idea: { label: "Idea", icon: "lightbulb", tone: "var(--premium)" },
  chore: { label: "Chore", icon: "wrench", tone: "var(--fg-2)" },
  decision: { label: "Decision", icon: "git-fork", tone: "var(--success)" },
};

export const PRIORITY_META: Record<Priority, { label: string; rank: number }> = {
  low: { label: "Low", rank: 1 },
  med: { label: "Medium", rank: 2 },
  high: { label: "High", rank: 3 },
};

export const RESOURCE_META: Record<ResourceType, { icon: string }> = {
  file: { icon: "file-code" },
  url: { icon: "link" },
  note: { icon: "sticky-note" },
  doc: { icon: "file-text" },
  folder: { icon: "folder" },
};

export const AUTHOR_META: Record<
  NoteAuthor,
  { label: string; avatar?: string; icon?: string }
> = {
  user: { label: "You", avatar: "Y" },
  agent: { label: "Agent", icon: "sparkles" },
};

export const TYPES = Object.keys(TYPE_META) as ThreadType[];
export const STATUSES = COLUMNS.map((c) => c.id);
export const PRIORITIES = Object.keys(PRIORITY_META) as Priority[];
