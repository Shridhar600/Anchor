/* Anchor — transient overlays: toasts, confirm dialog, shortcut sheet.
   pushToast / dismissToast are exported so any module can fire them. */
import { useState, useEffect } from "react";
import { Icon } from "../lib/ui";

/* ---- Toast store ---- */
export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  message: string;
  duration: number;
  actionLabel?: string;
  onAction?: () => void;
}

const _toastSubs = new Set<(toasts: Toast[]) => void>();
let _toasts: Toast[] = [];

function _emit() {
  _toastSubs.forEach((fn) => fn(_toasts));
}

export function pushToast(
  toast: Partial<Pick<Toast, "kind">> & Omit<Toast, "id" | "duration" | "kind"> & { duration?: number }
): number {
  const id = Date.now() + Math.random();
  const t: Toast = { id, kind: toast.kind ?? "info", duration: toast.duration ?? 3600, ...toast };
  _toasts = [..._toasts, t];
  _emit();
  if (t.duration !== 0) setTimeout(() => dismissToast(id), t.duration);
  return id;
}

export function dismissToast(id: number) {
  _toasts = _toasts.filter((t) => t.id !== id);
  _emit();
}

const TOAST_ICON: Record<string, string> = {
  info: "info",
  success: "check-circle-2",
  error: "alert-triangle",
};

export function ToastHost() {
  const [list, setList] = useState<Toast[]>(_toasts);
  useEffect(() => {
    _toastSubs.add(setList);
    return () => {
      _toastSubs.delete(setList);
    };
  }, []);
  return (
    <div className="toast-host" role="region" aria-label="Notifications">
      {list.map((t) => (
        <div key={t.id} className={"toast t-" + t.kind} role="status">
          <span className="toast-ic">
            <Icon name={TOAST_ICON[t.kind] || "info"} size={16} />
          </span>
          <span className="toast-msg">{t.message}</span>
          {t.actionLabel && (
            <button
              className="toast-act"
              onClick={() => {
                if (t.onAction) t.onAction();
                dismissToast(t.id);
              }}
            >
              {t.actionLabel}
            </button>
          )}
          <button
            className="toast-x"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---- Confirm dialog (controlled) ---- */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onCancel}>
      <div
        className="confirm"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-label={title}
      >
        <h3 className="confirm-title">{title}</h3>
        {body && <p className="confirm-body">{body}</p>}
        <div className="confirm-actions">
          <button className="ghost-btn" onClick={onCancel}>
            {cancelLabel || "Cancel"}
          </button>
          <button
            className={"primary-btn is-sm" + (danger ? " is-danger" : "")}
            onClick={onConfirm}
          >
            {confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- Keyboard shortcut cheat-sheet (⌘/) ---- */
const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Search & jump" },
  { keys: ["⌘", "N"], label: "New thread" },
  { keys: ["⌘", "B"], label: "Toggle sidebar" },
  { keys: ["⌘", "["], label: "Back" },
  { keys: ["⌘", "]"], label: "Forward" },
  { keys: ["⌘", ","], label: "Settings" },
  { keys: ["⌘", "/"], label: "Keyboard shortcuts" },
  { keys: ["⇥"], label: "Move thread (in search)" },
  { keys: ["⏎"], label: "Open / confirm" },
  { keys: ["Esc"], label: "Close / cancel" },
];

export function ShortcutSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
      >
        <div className="sheet-head">
          <h3 className="sheet-title">Keyboard shortcuts</h3>
          <button className="dp-icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="sheet-grid">
          {SHORTCUTS.map((s, i) => (
            <div className="sheet-row" key={i}>
              <span className="sheet-label">{s.label}</span>
              <span className="sheet-keys">
                {s.keys.map((k, j) => (
                  <kbd key={j}>{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
