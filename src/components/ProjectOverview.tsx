/* ProjectOverview — the project page. Info + threads + all resources. */
import { useState, useRef, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon, TypeIcon, PrioBars, ColDot, latestCheckpoint, statusLabel } from "../lib/ui";
import { EmptyState } from "./States";
import { ResourceRow, ResourceComposer } from "./Resource";
import { IconPicker } from "./IconPicker";
import { pushToast } from "./Overlays";
import type { Project, Thread, Resource, ThreadStatus, ResourceType } from "../lib/types";
import type { COLUMNS } from "../lib/meta";

type Column = (typeof COLUMNS)[number];

function OvEditableName({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  if (editing) {
    const save = () => {
      const v = draft.trim();
      if (v) onSave(v);
      setEditing(false);
    };
    return (
      <input
        ref={ref}
        className="ov-name-edit"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <h1
      className="ov-name ov-name-editable"
      onClick={() => setEditing(true)}
      title="Rename project"
    >
      <span className="ov-name-text">{value}</span>
      <Icon name="pencil" size={14} className="ov-edit-pencil" />
    </h1>
  );
}

function OvEditableDesc({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);

  if (editing) {
    const save = () => {
      onSave(draft.trim() || "No description yet.");
      setEditing(false);
    };
    return (
      <textarea
        ref={ref}
        className="ov-desc-edit"
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <div className="ov-desc-wrap">
      <p className="ov-desc" onClick={() => setEditing(true)}>
        {value}
      </p>
      <button
        className="ov-desc-editbtn"
        onClick={() => setEditing(true)}
        title="Edit description"
        aria-label="Edit description"
      >
        <Icon name="pencil" size={14} />
      </button>
    </div>
  );
}

function OvEditablePath({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  const handleBrowse = async () => {
    try {
      const result = await open({ directory: true });
      if (result === null) return;
      const picked = result as string;
      setDraft(picked);
      onSave(picked);
    } catch (e) {
      pushToast({ kind: "error", message: `Couldn't open folder picker: ${String(e)}` });
    }
  };

  const save = () => onSave(draft.trim());

  return (
    <div className="field-input-wrap ov-meta-input-wrap">
      <Icon name="folder" size={13} className="ov-meta-icon" />
      <input
        className="field-input mono ov-meta-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="No local path"
      />
      <button
        className="ghost-btn field-browse"
        type="button"
        onClick={handleBrowse}
        title="Browse for folder"
        aria-label="Browse for folder"
      >
        Browse…
      </button>
    </div>
  );
}

function OvEditableRemote({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  const save = () => onSave(draft.trim());

  return (
    <div className="field-input-wrap ov-meta-input-wrap">
      <Icon name="git-branch" size={13} className="ov-meta-icon" />
      <input
        className="field-input mono ov-meta-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="github.com/you/project"
      />
    </div>
  );
}

const OV_THREADS_SHOWN = 4;
const OV_RES_SHOWN = 3;

export function ProjectOverview({
  project,
  threads,
  projectResources,
  columns,
  onOpenThread,
  onSaveProject,
  onNewThread,
  onAddResource,
  onDeleteProjectResource,
  onDeleteThreadResource,
}: {
  project: Project;
  threads: Thread[];
  projectResources: Resource[];
  columns: Column[];
  onOpenThread: (ticket: string) => void;
  onSaveProject: (key: string, patch: Partial<Pick<Project, "name" | "description" | "icon" | "path" | "remote">>) => void;
  onNewThread?: (status: ThreadStatus) => void;
  onAddResource: (res: { type: ResourceType; label: string; value: string }) => void;
  onDeleteProjectResource: (r: Resource) => void;
  onDeleteThreadResource: (ticket: string, r: Resource) => void;
}) {
  const projRes = projectResources.filter((r) => r.project === project.key);
  const threadRes = threads.flatMap((t) => t.resources);
  type ScopedResource = { r: Resource; scope: "project" | "thread" };
  const allRes: ScopedResource[] = [
    ...projRes.map((r) => ({ r, scope: "project" as const })),
    ...threadRes.map((r) => ({ r, scope: "thread" as const })),
  ];

  const byStatus = columns.map((c) => ({
    col: c,
    count: threads.filter((t) => t.status === c.id).length,
  }));
  const open = threads.filter((t) => t.status !== "done").length;

  const [showAllThreads, setShowAllThreads] = useState(false);
  const [showAllRes, setShowAllRes] = useState(false);
  const [addingRes, setAddingRes] = useState(false);

  const shownThreads = showAllThreads
    ? threads
    : threads.slice(0, OV_THREADS_SHOWN);
  const moreThreads = threads.length - OV_THREADS_SHOWN;

  const shownRes = showAllRes ? allRes : allRes.slice(0, OV_RES_SHOWN);
  const moreRes = allRes.length - OV_RES_SHOWN;
  const projShown = shownRes
    .filter((x) => x.scope === "project")
    .map((x) => x.r);
  const threadShown = shownRes
    .filter((x) => x.scope === "thread")
    .map((x) => x.r);

  return (
    <div className="ov-scroll">
      <div className="ov">
        <div className="ov-head">
          <IconPicker
            value={project.icon || "box"}
            size="lg"
            onChange={(ic) => onSaveProject(project.key, { icon: ic })}
          />
          <div className="ov-head-main">
            <OvEditableName
              value={project.name}
              onSave={(v) => onSaveProject(project.key, { name: v })}
            />
            <span className="ov-key-sub" title="Ticket prefix">
              {project.key}
            </span>
          </div>
          {project.status === "archived" && (
            <span className="ov-archived">Archived</span>
          )}
        </div>
        <OvEditableDesc
          value={project.description}
          onSave={(v) => onSaveProject(project.key, { description: v })}
        />

        <div className="ov-meta-fields">
          <div className="ov-meta-row">
            <span className="ov-meta-label">Path</span>
            <OvEditablePath
              value={project.path}
              onSave={(v) => onSaveProject(project.key, { path: v })}
            />
          </div>
          <div className="ov-meta-row">
            <span className="ov-meta-label">Remote</span>
            <OvEditableRemote
              value={project.remote}
              onSave={(v) => onSaveProject(project.key, { remote: v })}
            />
          </div>
        </div>

        <div className="ov-stats">
          {byStatus.map(({ col, count }) => (
            <div className="ov-stat" key={col.id}>
              <div className="ov-stat-top">
                <ColDot status={col.id} />
                <span className="ov-stat-n">{count}</span>
              </div>
              <div className="ov-stat-l">{col.label}</div>
            </div>
          ))}
        </div>

        <div className="dp-sec-head">
          <h3>Threads</h3>
          <span className="dp-sec-count">
            {open} open · {threads.length} total
          </span>
          <span className="line" />
          <button
            className="ghost-btn"
            onClick={() => onNewThread && onNewThread("backlog")}
          >
            <Icon name="plus" size={13} />
            New thread
          </button>
        </div>
        <div className="list ov-list">
          {shownThreads.map((t) => {
            const ck = latestCheckpoint(t);
            return (
              <div
                key={t.ticket}
                className="row"
                onClick={() => onOpenThread(t.ticket)}
              >
                <TypeIcon type={t.type} />
                <span className="row-key">{t.ticket}</span>
                <span className="row-title">{t.title}</span>
                {t.branch && (
                  <span className="card-branch row-branch" title={t.branch}>
                    <Icon name="git-branch" size={11} />
                    <span>{t.branch}</span>
                  </span>
                )}
                {ck && (
                  <span className="card-ckpt">
                    <Icon name="bookmark-check" size={12} />
                  </span>
                )}
                <PrioBars priority={t.priority} />
                <span className="row-status">
                  <ColDot status={t.status} />
                  {statusLabel(t.status)}
                </span>
              </div>
            );
          })}
          {threads.length === 0 && (
            <EmptyState
              compact
              icon="git-branch"
              title="No threads yet"
              message="Threads track features, bugs, decisions, and where you left off."
              actionLabel="New thread"
              onAction={() => onNewThread && onNewThread("backlog")}
            />
          )}
        </div>
        {moreThreads > 0 && (
          <button
            className="log-more"
            onClick={() => setShowAllThreads((v) => !v)}
          >
            <Icon
              name={showAllThreads ? "chevron-up" : "chevron-down"}
              size={14}
            />
            {showAllThreads
              ? "Show fewer"
              : `Show ${moreThreads} more ${moreThreads === 1 ? "thread" : "threads"}`}
          </button>
        )}

        <div className="dp-sec-head">
          <h3>Resources</h3>
          <span className="dp-sec-count">{allRes.length}</span>
          <span className="line" />
          <button
            className={"ghost-btn" + (addingRes ? " is-on" : "")}
            onClick={() => setAddingRes((v) => !v)}
          >
            <Icon name="plus" size={13} />
            Add resource
          </button>
        </div>
        {addingRes && (
          <ResourceComposer
            onAdd={(r) => {
              onAddResource(r);
              setAddingRes(false);
            }}
            onClose={() => setAddingRes(false)}
          />
        )}

        {projShown.length > 0 && (
          <div className="ov-res-group">
            <div className="ov-res-label">
              <Icon name="folder" size={12} />
              Project
            </div>
            <div className="res-list">
              {projShown.map((r, i) => (
                <ResourceRow
                  key={i}
                  r={r}
                  onDelete={() => onDeleteProjectResource(r)}
                />
              ))}
            </div>
          </div>
        )}
        {threadShown.length > 0 && (
          <div className="ov-res-group">
            <div className="ov-res-label">
              <Icon name="git-branch" size={12} />
              From threads
            </div>
            <div className="res-list">
              {threadShown.map((r, i) => (
                <ResourceRow
                  key={i}
                  r={r}
                  scopeBadge={r.thread}
                  onDelete={() =>
                    r.thread
                      ? onDeleteThreadResource(r.thread, r)
                      : onDeleteProjectResource(r)
                  }
                />
              ))}
            </div>
          </div>
        )}
        {allRes.length === 0 && !addingRes && (
          <EmptyState
            compact
            icon="paperclip"
            title="No resources yet"
            message="Pin files, links, and docs the whole project should keep close."
            actionLabel="Add resource"
            onAction={() => setAddingRes(true)}
          />
        )}
        {moreRes > 0 && (
          <button
            className="log-more"
            onClick={() => setShowAllRes((v) => !v)}
          >
            <Icon
              name={showAllRes ? "chevron-up" : "chevron-down"}
              size={14}
            />
            {showAllRes
              ? "Show fewer"
              : `Show ${moreRes} more ${moreRes === 1 ? "resource" : "resources"}`}
          </button>
        )}
      </div>
    </div>
  );
}
