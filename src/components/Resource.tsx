/* Anchor — resource bits shared by the detail panel and the project overview.
   ResourceRow renders one attached resource (with an optional delete);
   FileField is a reusable file/folder picker control;
   ResourceComposer is the "attach resource" form (Link / File / Folder / Note). */
import { useState, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../lib/ui";
import { RESOURCE_META } from "../lib/meta";
import { basename } from "../lib/format";
import { pushToast } from "./Overlays";
import type { Resource, ResourceType } from "../lib/types";

// Only the 4 composer-offered types (doc stays in RESOURCE_META for display,
// but is never offered in the composer).
type ComposerType = "url" | "file" | "folder" | "note";
const COMPOSER_TYPES: { type: ComposerType; label: string }[] = [
  { type: "url", label: "Link" },
  { type: "file", label: "File" },
  { type: "folder", label: "Folder" },
  { type: "note", label: "Note" },
];

const RES_PLACEHOLDER: Record<ComposerType, string> = {
  url: "https://…",
  note: "A short note",
  file: "",
  folder: "",
};

function isPlausibleUrl(v: string): boolean {
  if (!v.trim()) return false;
  if (/^https?:\/\/.+/.test(v)) return true;
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

/* FileField — a form-grade file/folder picker control. Looks like an input
   with a segmented Browse/Change button; shows the chosen absolute path with
   a clear (×). Wired to the native Tauri dialog. */
export function FileField({
  kind,
  value,
  onPick,
  onClear,
}: {
  kind: "file" | "folder";
  value: string;
  onPick: () => void;
  onClear: () => void;
}) {
  const ic = value
    ? RESOURCE_META[kind]?.icon ?? (kind === "folder" ? "folder" : "file")
    : kind === "folder"
    ? "folder"
    : "file";

  return (
    <div className={"filefield" + (value ? " is-chosen" : "")}>
      <span className="filefield-ic">
        <Icon name={ic} size={15} />
      </span>
      {value ? (
        <span className="filefield-path mono" title={value}>
          {value}
        </span>
      ) : (
        <span className="filefield-ph">No {kind} selected</span>
      )}
      {value && (
        <button
          className="filefield-clear"
          onClick={onClear}
          title="Clear"
          aria-label="Clear"
          type="button"
        >
          <Icon name="x" size={14} />
        </button>
      )}
      <button className="filefield-btn" onClick={onPick} type="button">
        <Icon name="folder-search" size={14} />
        {value ? "Change" : "Browse"}
      </button>
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
  const labelRef = useRef<HTMLInputElement>(null);

  // Focus label on mount
  useEffect(() => {
    if (labelRef.current) labelRef.current.focus();
  }, []);

  const isPath = type === "file" || type === "folder";

  // Reset value when type changes
  const switchType = (t: ComposerType) => {
    setType(t);
    setValue("");
  };

  const handleBrowse = async () => {
    try {
      const result = await open({
        multiple: false,
        directory: type === "folder",
      });
      if (result === null) return; // user cancelled
      const picked = result as string;
      setValue(picked);
      if (!label.trim()) {
        setLabel(basename(picked));
      }
    } catch (e) {
      pushToast({ kind: "error", message: `Couldn't open picker: ${String(e)}` });
    }
  };

  const isValid = (): boolean => {
    if (!label.trim()) return false;
    if (type === "url") return isPlausibleUrl(value);
    if (type === "file" || type === "folder") return !!value;
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

  return (
    <div className="rescomp">
      <div className="rescomp-types" role="tablist" aria-label="Resource type">
        {COMPOSER_TYPES.map((t) => (
          <button
            key={t.type}
            className={"rescomp-type" + (type === t.type ? " is-on" : "")}
            onClick={() => switchType(t.type)}
          >
            <Icon name={RESOURCE_META[t.type].icon} size={14} />
            {t.label}
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

      {isPath ? (
        <FileField
          kind={type as "file" | "folder"}
          value={value}
          onPick={handleBrowse}
          onClear={() => setValue("")}
        />
      ) : type === "note" ? (
        <textarea
          className="field-input field-area rescomp-in"
          rows={3}
          placeholder={RES_PLACEHOLDER.note}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
        />
      ) : (
        <input
          className="field-input mono rescomp-in"
          placeholder={RES_PLACEHOLDER.url}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
        />
      )}

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
          Add
        </button>
      </div>
    </div>
  );
}
