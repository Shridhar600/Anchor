// Typed wrappers over the Tauri command layer (src-tauri/src/commands.rs).
// Arg shapes verified against the Rust signatures: most mutations take a single
// `args` struct; reads take individual params. Tauri v2 maps JS camelCase →
// Rust snake_case, so `resource_id` is passed as `resourceId`.
//
// Errors: commands reject with an ApiError serialized as { message, kind }.
// Callers should catch and surface via the toast/error UI.

import { invoke } from "@tauri-apps/api/core";
import type {
  AddResourceArgs,
  AppendNoteArgs,
  CreateProjectArgs,
  CreateThreadArgs,
  Note,
  Project,
  ProjectStatus,
  Resource,
  Settings,
  Thread,
  ThreadStatus,
  UpdateProjectArgs,
  UpdateThreadArgs,
} from "./types";

// ---- projects ----
export const listProjects = () => invoke<Project[]>("list_projects");

export const getProject = (key: string) =>
  invoke<Project>("get_project", { key });

export const createProject = (args: CreateProjectArgs) =>
  invoke<Project>("create_project", { args });

export const updateProject = (args: UpdateProjectArgs) =>
  invoke<Project>("update_project", { args });

export const setProjectStatus = (key: string, status: ProjectStatus) =>
  invoke<Project>("set_project_status", { args: { key, status } });

// ---- threads ----
export const listThreads = (project?: string) =>
  invoke<Thread[]>("list_threads", { project: project ?? null });

export const getThread = (ticket: string) =>
  invoke<Thread>("get_thread", { ticket });

export const createThread = (args: CreateThreadArgs) =>
  invoke<Thread>("create_thread", { args });

export const updateThread = (args: UpdateThreadArgs) =>
  invoke<Thread>("update_thread", { args });

export const moveThread = (ticket: string, status: ThreadStatus) =>
  invoke<Thread>("move_thread", { args: { ticket, status } });

export const deleteThread = (ticket: string) =>
  invoke<void>("delete_thread", { ticket });

// ---- notes (append-only: no edit/delete) ----
export const appendNote = (args: AppendNoteArgs) =>
  invoke<Note>("append_note", { args });

// ---- resources ----
export const addResource = (args: AddResourceArgs) =>
  invoke<Resource>("add_resource", { args });

export const deleteResource = (resourceId: number) =>
  invoke<void>("delete_resource", { resourceId });

// ---- settings ----
export const getSettings = () => invoke<Settings>("get_settings");

export const setSettings = (actor: string) =>
  invoke<Settings>("set_settings", { args: { actor } });
