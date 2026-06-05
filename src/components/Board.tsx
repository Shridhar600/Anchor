/* Board — Kanban (5 columns) or List. Native HTML5 drag-and-drop between columns. */
import { useState } from "react";
import { Icon, TypeIcon, PrioBars, ColDot, latestCheckpoint, statusLabel } from "../lib/ui";
import { EmptyState } from "./States";
import type { Thread, ThreadStatus } from "../lib/types";
import type { COLUMNS } from "../lib/meta";

type Column = (typeof COLUMNS)[number];

interface CardProps {
  thread: Thread;
  selected: boolean;
  onOpen: (ticket: string) => void;
  onDragStart: (e: React.DragEvent, thread: Thread) => void;
  onDragEnd: () => void;
  draggable: boolean;
}

function Card({ thread, selected, onOpen, onDragStart, onDragEnd, draggable }: CardProps) {
  const ck = latestCheckpoint(thread);
  return (
    <div
      className={"card" + (selected ? " is-selected" : "")}
      draggable={draggable}
      onDragStart={(e) => onDragStart(e, thread)}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(thread.ticket)}
    >
      <div className="card-top">
        <TypeIcon type={thread.type} />
        <span className="card-key">{thread.ticket}</span>
        <PrioBars priority={thread.priority} />
      </div>
      <div className="card-title">{thread.title}</div>
      <div className="card-foot">
        {thread.branch && (
          <span className="card-branch" title={thread.branch}>
            <Icon name="git-branch" size={11} />
            <span>{thread.branch}</span>
          </span>
        )}
        {thread.notes.length > 0 && (
          <span className="card-meta">
            <Icon name="message-square-text" size={12} />
            {thread.notes.length}
          </span>
        )}
        {ck && (
          <span className="card-ckpt" title="Has a checkpoint — where you left off">
            <Icon name="bookmark-check" size={12} />
          </span>
        )}
      </div>
    </div>
  );
}

interface ListViewProps {
  threads: Thread[];
  columns: Column[];
  selectedTicket: string | null;
  onOpenThread: (ticket: string) => void;
  onNewThread?: (status: ThreadStatus) => void;
  filtersActive: boolean;
  isAll: boolean;
}

function ListView({ threads, columns, selectedTicket, onOpenThread, onNewThread, filtersActive, isAll }: ListViewProps) {
  const order = columns.map((c) => c.id);
  const sorted = threads
    .slice()
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));

  const addRow = (
    <button
      className="row row-new"
      onClick={() => onNewThread && onNewThread("backlog")}
    >
      <Icon name="plus" size={14} />
      <span className="row-new-label">New thread</span>
    </button>
  );

  if (!sorted.length) {
    return (
      <div className="board">
        {filtersActive ? (
          <div className="list">
            <div className="list-empty">No threads match the current filters.</div>
            {addRow}
          </div>
        ) : (
          <EmptyState
            icon="inbox"
            title={isAll ? "No threads yet" : "This list is empty"}
            message={
              isAll
                ? "Threads from all your projects show up here."
                : "Create your first thread to start tracking work."
            }
            actionLabel={isAll ? undefined : "New thread"}
            onAction={isAll ? undefined : () => onNewThread && onNewThread("backlog")}
          />
        )}
      </div>
    );
  }

  return (
    <div className="board">
      <div className="list">
        {sorted.map((t) => {
          const ck = latestCheckpoint(t);
          return (
            <div
              key={t.ticket}
              className={"row" + (selectedTicket === t.ticket ? " is-selected" : "")}
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
        {addRow}
      </div>
    </div>
  );
}

interface BoardProps {
  threads: Thread[];
  columns: Column[];
  view: "board" | "list";
  sortActive: boolean;
  filtersActive: boolean;
  isAll: boolean;
  selectedTicket: string | null;
  onOpenThread: (ticket: string) => void;
  onMove: (ticket: string, status: ThreadStatus) => void;
  onNewThread?: (status: ThreadStatus) => void;
}

export function Board({
  threads,
  columns,
  view,
  sortActive: _sortActive,
  filtersActive,
  isAll,
  selectedTicket,
  onOpenThread,
  onMove,
  onNewThread,
}: BoardProps) {
  const [dragTicket, setDragTicket] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  if (view === "list") {
    return (
      <ListView
        threads={threads}
        columns={columns}
        selectedTicket={selectedTicket}
        onOpenThread={onOpenThread}
        onNewThread={onNewThread}
        filtersActive={filtersActive}
        isAll={isAll}
      />
    );
  }

  if (threads.length === 0 && !filtersActive) {
    return (
      <div className="board">
        <EmptyState
          icon="inbox"
          title={isAll ? "No threads yet" : "This board is empty"}
          message={
            isAll
              ? "Threads from all your projects show up here."
              : "Create your first thread to start tracking work."
          }
          actionLabel={isAll ? undefined : "New thread"}
          onAction={isAll ? undefined : () => onNewThread && onNewThread("backlog")}
        />
      </div>
    );
  }

  const onDragStart = (e: React.DragEvent, thread: Thread) => {
    setDragTicket(thread.ticket);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", thread.ticket);
    } catch (_) { /* ignore */ }
  };
  const onDragEnd = () => {
    setDragTicket(null);
    setOverCol(null);
  };

  return (
    <div className="board">
      <div className="board-cols">
        {columns.map((col) => {
          const items = threads.filter((t) => t.status === col.id);
          return (
            <div className="col" key={col.id}>
              <div className="col-head">
                <ColDot status={col.id} />
                <span className="col-name">{col.label}</span>
                <span className="col-count">{items.length}</span>
                <button
                  className="col-add"
                  title="New thread"
                  aria-label="New thread"
                  onClick={() => onNewThread && onNewThread(col.id)}
                >
                  <Icon name="plus" size={15} />
                </button>
              </div>
              <div
                className={"col-body" + (overCol === col.id ? " is-over" : "")}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (overCol !== col.id) setOverCol(col.id);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget === e.target) setOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragTicket) onMove(dragTicket, col.id);
                  setOverCol(null);
                  setDragTicket(null);
                }}
              >
                {items.map((t) => (
                  <div
                    key={t.ticket}
                    style={dragTicket === t.ticket ? { opacity: 0.45 } : undefined}
                  >
                    <Card
                      thread={t}
                      selected={selectedTicket === t.ticket}
                      draggable={true}
                      onOpen={onOpenThread}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="col-empty">
                    {overCol === col.id
                      ? "Drop here"
                      : filtersActive
                      ? "No matches"
                      : "No threads"}
                  </div>
                )}
                <button
                  className="col-newcard"
                  onClick={() => onNewThread && onNewThread(col.id)}
                  title="New thread"
                >
                  <Icon name="plus" size={14} />
                  New thread
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
