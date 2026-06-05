/* DetailPanel — slide-over thread detail.
   Description + note log (latest checkpoint sits naturally at the top) + resources. */
import { useState, useEffect, useRef } from "react";
import {
  Icon,
  ColDot,
  statusLabel,
  toneBg,
  AuthorBadge,
} from "../lib/ui";
import { TYPE_META, PRIORITY_META, AUTHOR_META } from "../lib/meta";
import { InlineError, SkeletonDetail } from "./States";
import { EmptyState } from "./States";
import { ResourceRow, ResourceComposer } from "./Resource";
import type { Thread, Project, Note, Resource, ThreadStatus, NoteKind, ResourceType } from "../lib/types";
import type { COLUMNS } from "../lib/meta";

type Column = (typeof COLUMNS)[number];

/* Clamp long user text to N lines with a Show more / Show less toggle. */
function Clampable({
  text,
  className,
  lines,
}: {
  text: string;
  className: string;
  lines: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setExpanded(false);
    const id = requestAnimationFrame(() => {
      if (ref.current)
        setOverflow(ref.current.scrollHeight > ref.current.clientHeight + 1);
    });
    return () => cancelAnimationFrame(id);
  }, [text, lines]);

  return (
    <>
      <div
        ref={ref}
        className={className + (expanded ? "" : " is-clamped")}
        style={expanded ? undefined : { WebkitLineClamp: lines }}
      >
        {text}
      </div>
      {(overflow || expanded) && (
        <button
          className="clamp-toggle"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

function NoteComposer({
  onAppend,
}: {
  onAppend: (n: { author: "user"; kind: NoteKind; body: string; at: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NoteKind>("log");
  const [body, setBody] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && ref.current) ref.current.focus();
  }, [open]);

  if (!open) {
    return (
      <div className="log-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={15} />
        <span>Append to log…</span>
        <span className="kinds">
          <span>log</span>
          <span>checkpoint</span>
          <span>decision</span>
        </span>
      </div>
    );
  }

  const submit = () => {
    const text = body.trim();
    if (!text) {
      setOpen(false);
      return;
    }
    onAppend({ author: "user", kind, body: text, at: new Date().toISOString() });
    setBody("");
    setKind("log");
    setOpen(false);
  };

  return (
    <div className="composer">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="What happened, decided, or where you stopped…"
        rows={3}
      />
      <div className="composer-foot">
        {(["log", "checkpoint", "decision"] as NoteKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={"kind-pick t-" + k + (kind === k ? " is-on" : "")}
          >
            {k}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <span className="cp-hint" style={{ marginRight: "4px" }}>
          ⌘⏎
        </span>
        <button onClick={submit} className="primary-btn is-sm">
          Append
        </button>
      </div>
    </div>
  );
}

function NoteItem({
  note,
  actorName,
}: {
  note: Note;
  actorName: string;
}) {
  const am = AUTHOR_META[note.author] ?? AUTHOR_META.user;
  const isUser = note.author === "user";
  const name = isUser ? actorName || am.label : am.label;
  const avatar = isUser
    ? (actorName || "You").charAt(0).toUpperCase()
    : am.avatar || "";

  // fmtTime inline to avoid circular import issues
  const fmtNote = (iso: string) => {
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
      year: then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    });
  };

  return (
    <div className={"note k-" + note.kind}>
      <div className="note-rail">
        <div className={"note-av " + note.author} title={name}>
          {am.icon ? <Icon name={am.icon} size={12} /> : avatar}
        </div>
        <div className="note-line" />
      </div>
      <div className="note-main">
        <div className="note-head">
          <span className={"note-kind t-" + note.kind}>{note.kind}</span>
          <span className="note-author-name">{name}</span>
          <span className="note-when">{fmtNote(note.at)}</span>
        </div>
        <Clampable text={note.body} className="note-body" lines={5} />
      </div>
    </div>
  );
}

function EditableTitle({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);
  useEffect(() => {
    setDraft(value || "");
  }, [value]);
  useEffect(() => {
    if (!value) setEditing(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    const save = () => {
      const v = draft.trim();
      if (v) onSave(v);
      setEditing(false);
    };
    return (
      <textarea
        ref={ref}
        className="dp-title-edit"
        value={draft}
        rows={1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") {
            setDraft(value || "");
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <div className="dp-title-wrap">
      <h1 className="dp-title">
        {value || <span className="dp-title-ph">Untitled thread</span>}
      </h1>
      <button
        className="dp-desc-edit dp-title-editbtn"
        onClick={() => setEditing(true)}
        title="Edit title"
        aria-label="Edit title"
      >
        <Icon name="pencil" size={13} />
      </button>
    </div>
  );
}

function EditableDescription({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);
  useEffect(() => {
    setDraft(value || "");
  }, [value]);

  if (editing) {
    const save = () => {
      onSave(draft.trim());
      setEditing(false);
    };
    return (
      <div className="composer" style={{ marginTop: "16px" }}>
        <textarea
          ref={ref}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            if (e.key === "Escape") {
              setDraft(value || "");
              setEditing(false);
            }
          }}
          placeholder="Describe this thread…"
          rows={3}
        />
        <div className="composer-foot">
          <span style={{ flex: 1 }} />
          <button
            className="ghost-btn"
            onClick={() => {
              setDraft(value || "");
              setEditing(false);
            }}
          >
            Cancel
          </button>
          <span className="cp-hint" style={{ margin: "0 4px" }}>
            ⌘⏎
          </span>
          <button onClick={save} className="primary-btn is-sm">
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dp-desc-wrap">
      {value ? (
        <Clampable text={value} className="dp-desc" lines={6} />
      ) : (
        <p className="dp-desc dp-desc-empty">No description yet.</p>
      )}
      <button
        className="dp-desc-edit"
        onClick={() => setEditing(true)}
        title="Edit description"
        aria-label="Edit description"
      >
        <Icon name="pencil" size={13} />
      </button>
    </div>
  );
}

const LOG_VISIBLE = 4;

export function DetailPanel({
  project: _project,
  thread,
  columns,
  full,
  loading,
  error,
  onRetry,
  actorName,
  isDraft,
  onClose,
  onToggleFull,
  onMoveStatus,
  onAppendNote,
  onSaveDescription,
  onSaveTitle,
  onAddResource,
  onDeleteResource,
  onDeleteThread,
  onOpenStatusMenu,
  statusMenuOpen,
}: {
  project: Project | null;
  thread: Thread;
  columns: Column[];
  full: boolean;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  actorName: string;
  isDraft?: boolean;
  onClose: () => void;
  onToggleFull: () => void;
  onMoveStatus: (ticket: string, status: ThreadStatus) => void;
  onAppendNote: (ticket: string, n: { author: "user"; kind: NoteKind; body: string; at: string }) => void;
  onSaveDescription: (ticket: string, description: string) => void;
  onSaveTitle: (ticket: string, title: string) => void;
  onAddResource: (res: { type: ResourceType; label: string; value: string }) => void;
  onDeleteResource: (r: Resource) => void;
  onDeleteThread: () => void;
  onOpenStatusMenu: () => void;
  statusMenuOpen: boolean;
}) {
  const meta = TYPE_META[thread.type];
  const tone = meta.tone;
  const [showAll, setShowAll] = useState(false);
  const [addingRes, setAddingRes] = useState(false);

  useEffect(() => {
    setShowAll(false);
    setAddingRes(false);
  }, [thread.ticket]);

  const log = thread.notes
    .slice()
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const hiddenCount = Math.max(0, log.length - LOG_VISIBLE);
  const shown = showAll ? log : log.slice(0, LOG_VISIBLE);

  const threadRes = thread.resources;

  return (
    <div className={"dp" + (full ? " is-full" : "")} onClick={(e) => e.stopPropagation()}>
      <div className="dp-bar">
        <span className="card-key">{isDraft ? "New thread" : thread.ticket}</span>
        <div style={{ position: "relative" }}>
          <button className="dp-bar-status" onClick={onOpenStatusMenu}>
            <ColDot status={thread.status} />
            {statusLabel(thread.status)}
            <Icon name="chevron-down" size={13} />
          </button>
          {statusMenuOpen && (
            <div className="status-menu">
              {columns.map((c) => (
                <button
                  key={c.id}
                  className="cp-item"
                  style={{ fontSize: "13px" }}
                  onClick={() => onMoveStatus(thread.ticket, c.id)}
                >
                  <span className="cp-ic">
                    <ColDot status={c.id} />
                  </span>
                  <span className="cp-item-title">{c.label}</span>
                  {thread.status === c.id && (
                    <Icon name="check" size={14} style={{ color: "var(--accent)" }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="dp-bar-spacer" />
        {!isDraft && (
          <button
            className="dp-icon dp-icon-danger"
            onClick={onDeleteThread}
            title="Delete thread"
            aria-label="Delete thread"
          >
            <Icon name="trash-2" size={16} />
          </button>
        )}
        <button
          className="dp-icon"
          onClick={onToggleFull}
          title={full ? "Collapse to panel" : "Expand to full width"}
          aria-label="Toggle width"
        >
          <Icon name={full ? "chevrons-right" : "chevrons-left"} size={16} />
        </button>
        <button className="dp-icon" onClick={onClose} title="Close" aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>

      <div className="dp-scroll">
        {error ? (
          <InlineError
            title="Couldn't load this thread"
            message="Something went wrong reading the thread from disk. Your data is safe."
            onRetry={onRetry}
          />
        ) : loading ? (
          <SkeletonDetail />
        ) : isDraft ? (
          <div className="dp-body dp-draft">
            <div className="dp-draft-eyebrow">
              <Icon name="git-branch" size={13} />
              New thread
            </div>
            <EditableTitle
              value={thread.title}
              onSave={(v) => onSaveTitle(thread.ticket, v)}
            />
            <p className="dp-draft-hint">
              Name your thread to create it. The note log and resources appear
              once it exists.
            </p>
            <div className="dp-draft-preview">
              <div className="dp-draft-prow">
                <Icon name="messages-square" size={15} />
                <span>Append-only note log</span>
              </div>
              <div className="dp-draft-prow">
                <Icon name="paperclip" size={15} />
                <span>Files, links, and docs</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="dp-body">
            <EditableTitle
              value={thread.title}
              onSave={(v) => onSaveTitle(thread.ticket, v)}
            />

            <div className="dp-attrs">
              <span className="attr">
                <span className="attr-type-ic" style={toneBg(tone)}>
                  <Icon name={meta.icon} size={12} />
                </span>
                {meta.label}
              </span>
              <span className="attr">
                <span className="attr-l">·</span>{" "}
                {PRIORITY_META[thread.priority].label} priority
              </span>
              {thread.branch && (
                <span className="attr-branch">
                  <Icon
                    name="git-branch"
                    size={12}
                    style={{ color: "var(--accent)" }}
                  />
                  {thread.branch}
                </span>
              )}
            </div>

            <EditableDescription
              value={thread.description}
              onSave={(v) => onSaveDescription(thread.ticket, v)}
            />

            <div className="dp-sec-head">
              <h3>Note log</h3>
              <span className="dp-sec-count">{thread.notes.length}</span>
              <span className="line" />
            </div>

            <NoteComposer onAppend={(n) => onAppendNote(thread.ticket, n)} />
            <div className="log">
              {shown.map((n, i) => (
                <NoteItem key={n.at + i} note={n} actorName={actorName} />
              ))}
            </div>
            {hiddenCount > 0 && !showAll && (
              <button className="log-more" onClick={() => setShowAll(true)}>
                <Icon name="chevron-down" size={14} />
                Show {hiddenCount} earlier {hiddenCount === 1 ? "note" : "notes"}
              </button>
            )}
            {showAll && hiddenCount > 0 && (
              <button className="log-more" onClick={() => setShowAll(false)}>
                <Icon name="chevron-up" size={14} />
                Collapse history
              </button>
            )}

            <div className="dp-sec-head">
              <h3>Resources</h3>
              <span className="dp-sec-count">{threadRes.length}</span>
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
                onAdd={(res) => {
                  onAddResource(res);
                  setAddingRes(false);
                }}
                onClose={() => setAddingRes(false)}
              />
            )}
            {threadRes.length > 0 ? (
              <div className="res-list">
                {threadRes.map((r, i) => (
                  <ResourceRow
                    key={i}
                    r={r}
                    onDelete={() => onDeleteResource(r)}
                  />
                ))}
              </div>
            ) : !addingRes ? (
              <EmptyState
                compact
                icon="paperclip"
                title="No resources yet"
                message="Attach a file, link, or doc to keep context with this thread."
                actionLabel="Add resource"
                onAction={() => setAddingRes(true)}
              />
            ) : null}

            <div className="later-hint">
              <Icon name="circle-dashed" size={15} />
              <span>
                <b>Room reserved.</b> Thread relations (blocking), live
                agent-session progress, and a delegate badge will live here —
                not built yet.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export AuthorBadge for any callers that need it from this module
export { AuthorBadge };
