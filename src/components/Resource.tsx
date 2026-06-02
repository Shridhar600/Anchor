/* Anchor — resource bits shared by the detail panel and the project overview.
   ResourceRow renders one attached resource (with an optional delete);
   ResourceComposer is the "attach resource" form. */
import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../lib/ui";
import { RESOURCE_META } from "../lib/meta";
import { pushToast } from "./Overlays";
import type { Resource, ResourceType } from "../lib/types";

// Only the 4 composer-offered types (doc stays in RESOURCE_META for display,
// but is never offered in the composer).
type ComposerType = "url" | "file" | "folder" | "note";
const COMPOSER_TYPES: ComposerType[] = ["url", "file", "folder", "note"];

const COMPOSER_LABEL: Record<ComposerType, string> = {
  url: "Link",
  file: "File",
  folder: "Folder",
  note: "Note",
};

function lastSegment(p: string): string {
  return p.replace(/\/+$/, "").split("/").pop() ?? p;
}

function isPlausibleUrl(v: string): boolean {
  if (!v.trim()) return false;
  if (/^https?:\/\/.+/.test(v)) return true;
  // bare host-like: must contain a dot and at least one slash or path after the host
  if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}(\/.*)?$/.test(v)) return true;
  return false;
}

export function ResourceRow({
  r,
  scopeBadge,
  onDelete,
}: {
  r: Resource;
  scopeBadge?: string | null;
  onDelete?: () => void;
}) {
  return (
    <div className="res">
      <span className="res-ic">
        <Icon name={RESOURCE_META[r.type]?.icon ?? "paperclip"} size={15} />
      </span>
      <div className="res-main">
        <div className="res-label">{r.label}</div>
        <div className="res-val">{r.value}</div>
      </div>
      {scopeBadge && <span className="res-scope">{scopeBadge}</span>}
      {onDelete ? (
        <button
          className="res-del"
          title="Remove resource"
          aria-label="Remove resource"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Icon name="trash-2" size={14} />
        </button>
      ) : (
        <span className="res-ext">
          <Icon name="arrow-up-right" size={14} />
        </span>
      )}
    </div>
  );
}

export function ResourceComposer({
  onAdd,
  onClose,
}: {
  onAdd: (res: { type: ResourceType; label: string; value: string }) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<ComposerType>("url");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [pickedPath, setPickedPath] = useState<string | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);

  // Focus label on mount
  useEffect(() => {
    if (labelRef.current) labelRef.current.focus();
  }, []);

  // Reset value/path when type changes
  useEffect(() => {
    setValue("");
    setPickedPath(null);
  }, [type]);

  const handleBrowse = async () => {
    try {
      const result = await open({
        multiple: false,
        directory: type === "folder",
      });
      if (result === null) return; // user cancelled
      const picked = result as string;
      setPickedPath(picked);
      setValue(picked);
      // Default label to last path segment if label is still empty
      if (!label.trim()) {
        setLabel(lastSegment(picked));
      }
    } catch (e) {
      pushToast({ kind: "error", message: `Couldn't open picker: ${String(e)}` });
    }
  };

  const handleClearPath = () => {
    setPickedPath(null);
    setValue("");
  };

  const isValid = (): boolean => {
    if (!label.trim()) return false;
    if (type === "url") return isPlausibleUrl(value);
    if (type === "file" || type === "folder") return !!pickedPath;
    if (type === "note") return !!value.trim();
    return false;
  };

  const submit = () => {
    if (!isValid()) return;
    onAdd({ type, label: label.trim(), value: value.trim() });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const renderValueField = () => {
    if (type === "file" || type === "folder") {
      return (
        <div className="rescomp-path-row">
          {pickedPath ? (
            <>
              <span className="rescomp-path-val mono">{pickedPath}</span>
              <button
                className="ghost-btn rescomp-path-clear"
                onClick={handleClearPath}
                title="Clear"
                aria-label="Clear selection"
              >
                <Icon name="x" size={13} />
              </button>
            </>
          ) : (
            <span className="rescomp-path-empty">No {type} chosen</span>
          )}
          <button
            className="ghost-btn rescomp-browse"
            onClick={handleBrowse}
            type="button"
          >
            <Icon name="folder-open" size={13} />
            Browse…
          </button>
        </div>
      );
    }
    if (type === "url") {
      return (
        <input
          ref={valueRef}
          className="field-input mono rescomp-in"
          placeholder="https://github.com/…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
        />
      );
    }
    // note
    return (
      <textarea
        className="field-input rescomp-in rescomp-textarea"
        placeholder="A short note or context…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        rows={3}
      />
    );
  };

  return (
    <div className="rescomp">
      <div className="rescomp-types" role="tablist" aria-label="Resource type">
        {COMPOSER_TYPES.map((t) => (
          <button
            key={t}
            className={"rescomp-type" + (type === t ? " is-on" : "")}
            onClick={() => setType(t)}
          >
            <Icon name={RESOURCE_META[t].icon} size={14} />
            {COMPOSER_LABEL[t]}
          </button>
        ))}
      </div>
      <input
        ref={labelRef}
        className="field-input rescomp-in"
        placeholder="Label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={onKey}
      />
      {renderValueField()}
      <div className="rescomp-foot">
        <span className="cp-hint">⌘⏎</span>
        <span style={{ flex: 1 }} />
        <button className="ghost-btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary-btn is-sm"
          disabled={!isValid()}
          onClick={submit}
        >
          Attach
        </button>
      </div>
    </div>
  );
}
