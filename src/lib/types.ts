// Anchor domain types — mirror the Tauri command DTOs (src-tauri/src/dto.rs).
// Key-based; numeric DB ids are never exposed (except ResourceDTO.id, the delete handle).

export type ThreadType = "feature" | "bug" | "idea" | "chore" | "decision";
export type ThreadStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "blocked"
  | "done";
export type Priority = "low" | "med" | "high";
export type ResourceType = "file" | "url" | "note" | "doc" | "folder";
export type NoteKind = "log" | "checkpoint" | "decision";
export type NoteAuthor = "user" | "agent";
export type ProjectStatus = "active" | "archived";

export interface Project {
  key: string;
  name: string;
  icon: string | null;
  description: string;
  path: string;
  remote: string;
  branch: string; // derived live from git HEAD; "" if none
  status: ProjectStatus;
  started: string; // ISO date
}

export interface Note {
  author: NoteAuthor;
  author_name: string | null;
  kind: NoteKind;
  body: string;
  at: string; // ISO datetime
}

export interface Resource {
  id: number;
  type: ResourceType;
  label: string;
  value: string;
  thread: string | null; // owning ticket_key, or null = project-level
  project: string;
}

export interface Thread {
  ticket: string;
  project: string;
  title: string;
  description: string;
  type: ThreadType;
  status: ThreadStatus;
  priority: Priority;
  branch: string | null;
  notes: Note[]; // ascending by `at`
  resources: Resource[];
}

export interface Settings {
  actor: string;
  db_path: string;
}

// ---- command argument shapes ----
export interface CreateProjectArgs {
  key: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  path?: string | null;
  remote?: string | null;
}
export interface UpdateProjectArgs {
  key: string;
  name?: string | null;
  icon?: string | null;
  description?: string | null;
  path?: string | null;
  remote?: string | null;
}
export interface CreateThreadArgs {
  project: string;
  title: string;
  type?: ThreadType;
  status?: ThreadStatus;
  priority?: Priority;
  branch?: string | null;
}
export interface UpdateThreadArgs {
  ticket: string;
  title?: string;
  description?: string;
  type?: ThreadType;
  priority?: Priority;
  branch?: string | null;
}
export interface AppendNoteArgs {
  ticket: string;
  kind: NoteKind;
  body: string;
  author?: NoteAuthor;
  author_name?: string | null;
}
export interface AddResourceArgs {
  project: string;
  thread?: string | null;
  type: ResourceType;
  label: string;
  value: string;
}
