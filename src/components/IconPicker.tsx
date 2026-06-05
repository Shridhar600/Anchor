/* IconPicker — pick a Lucide glyph for a project. Curated set. */
import { useState, useRef, useEffect } from "react";
import { Icon } from "../lib/ui";

export const PROJECT_ICONS = [
  "box",
  "anchor",
  "webhook",
  "sprout",
  "rocket",
  "flask-conical",
  "code",
  "code-xml",
  "terminal",
  "cpu",
  "database",
  "server",
  "cloud",
  "globe",
  "layers",
  "package",
  "folder-git-2",
  "git-branch",
  "book-open",
  "pen-tool",
  "palette",
  "ship",
  "compass",
  "map",
  "zap",
  "flame",
  "star",
  "bot",
  "brain",
  "bug",
  "shield",
  "bell",
  "calendar",
  "leaf",
  "mountain",
  "snowflake",
];

export function IconPicker({
  value,
  onChange,
  size = "md",
}: {
  value: string;
  onChange: (icon: string) => void;
  size?: "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = value || "box";
  return (
    <div className="iconpick" ref={ref}>
      <button
        type="button"
        className={"iconpick-trigger iconpick-" + size + (open ? " is-open" : "")}
        onClick={() => setOpen((o) => !o)}
        title="Choose icon"
        aria-label="Choose project icon"
      >
        <Icon name={current} size={size === "lg" ? 22 : 16} />
        <span className="iconpick-caret">
          <Icon name="chevron-down" size={12} />
        </span>
      </button>
      {open && (
        <div className="iconpick-pop">
          <div className="iconpick-grid">
            {PROJECT_ICONS.map((name) => (
              <button
                type="button"
                key={name}
                className={"iconpick-opt" + (name === current ? " is-sel" : "")}
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
              >
                <Icon name={name} size={17} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
