/* CreateProject — a focused page to create a new project. */
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Icon } from "../lib/ui";
import { IconPicker } from "./IconPicker";
import { pushToast } from "./Overlays";
import type { Project } from "../lib/types";

function deriveKey(name: string): string {
  const cleaned = (name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .trim();
  if (!cleaned) return "";
  const words = cleaned.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 6);
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 6);
}

export function CreateProject({
  onCancel,
  onCreate,
  existingKeys,
}: {
  onCancel: () => void;
  onCreate: (p: Project) => void;
  existingKeys: string[];
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("box");
  const [keyTouched, setKeyTouched] = useState(false);
  const [key, setKey] = useState("");
  const [path, setPath] = useState("");
  const [remote, setRemote] = useState("");
  const [description, setDescription] = useState("");

  const effectiveKey = keyTouched ? key : deriveKey(name);
  const keyClash = !!effectiveKey && existingKeys.includes(effectiveKey);
  const valid = !!name.trim() && !!effectiveKey && !keyClash;

  const handleBrowsePath = async () => {
    try {
      const result = await open({ directory: true });
      if (result === null) return;
      setPath(result as string);
    } catch (e) {
      pushToast({ kind: "error", message: `Couldn't open folder picker: ${String(e)}` });
    }
  };

  const submit = () => {
    if (!valid) return;
    onCreate({
      key: effectiveKey,
      name: name.trim(),
      icon,
      description: description.trim() || "No description yet.",
      path: path.trim(),
      remote: remote.trim(),
      branch: "main",
      status: "active",
      started: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="cpage-scroll">
      <div className="cpage">
        <button className="cpage-back" onClick={onCancel}>
          <Icon name="arrow-left" size={15} />
          Back
        </button>

        <div className="cpage-hero">
          <span className="cpage-hero-ic">
            <Icon name="folder-git-2" size={22} />
          </span>
          <h1 className="cpage-title">Create a project</h1>
          <p className="cpage-sub">
            A project holds its threads, an append-only note log, and resources
            — pinned to a real repo on disk.
          </p>
        </div>

        <div className="cpage-form">
          <div className="field field-split">
            <div className="field-icon">
              <label className="field-label">Icon</label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>
            <div className="field-grow">
              <label className="field-label">Name</label>
              <input
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aurora"
                autoFocus
              />
            </div>
            <div className="field-key">
              <label className="field-label">Key</label>
              <input
                className={"field-input mono" + (keyClash ? " is-error" : "")}
                value={effectiveKey}
                onChange={(e) => {
                  setKeyTouched(true);
                  setKey(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6)
                  );
                }}
                placeholder="AUR"
              />
            </div>
          </div>
          {keyClash ? (
            <div className="field-hint is-error">
              Key "{effectiveKey}" is already in use.
            </div>
          ) : (
            <div className="field-hint">
              Used to prefix every thread, e.g.{" "}
              <span className="mono">{effectiveKey || "AUR"}-1</span>.
            </div>
          )}

          <div className="field">
            <label className="field-label">
              Local path <span className="field-opt">optional</span>
            </label>
            <div className="field-input-wrap">
              <Icon name="folder" size={15} />
              <input
                className="field-input mono"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="~/Dev/Projects/aurora"
              />
              <button
                className="ghost-btn field-browse"
                type="button"
                onClick={handleBrowsePath}
                title="Browse for folder"
                aria-label="Browse for folder"
              >
                Browse…
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Git remote <span className="field-opt">optional</span>
            </label>
            <div className="field-input-wrap">
              <Icon name="git-branch" size={15} />
              <input
                className="field-input mono"
                value={remote}
                onChange={(e) => setRemote(e.target.value)}
                placeholder="github.com/you/aurora"
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Description <span className="field-opt">optional</span>
            </label>
            <textarea
              className="field-input field-area"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this project?"
            />
          </div>

          <div className="cpage-actions">
            <button className="ghost-btn" onClick={onCancel}>
              Cancel
            </button>
            <button
              className="primary-btn"
              disabled={!valid}
              onClick={submit}
            >
              <Icon name="check" size={15} />
              Create project
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
