/* Sidebar — full height. macOS traffic lights area, resize, workspace + projects, user menu.
   The fake WindowControls dot markup from the prototype is REMOVED — native traffic lights
   are shown by Tauri (titleBarStyle: Overlay). We just add top padding to clear them. */
import { useState, useRef, useEffect } from "react";
import { Icon } from "../lib/ui";
import type { Project } from "../lib/types";

export interface SidebarRoute {
  kind: "project" | "all" | "new-project";
  key?: string;
  tab?: "board" | "list" | "overview";
}

function SbItem({
  icon,
  label,
  active,
  onClick,
  action,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className={"sb-item-row" + (action ? " has-action" : "")}>
      <button className={"sb-item" + (active ? " is-active" : "")} onClick={onClick}>
        <span className="sb-item-ic">
          <Icon name={icon} size={16} />
        </span>
        <span className="sb-item-label">{label}</span>
      </button>
      {action}
    </div>
  );
}

function UserMenu({
  theme,
  onToggleTheme,
  actorName,
  onOpenSettings,
}: {
  theme: string;
  onToggleTheme: () => void;
  actorName: string;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const name = actorName || "You";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="sb-user" ref={ref}>
      <button
        className={"sb-user-row" + (open ? " is-open" : "")}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sb-av">{initial}</span>
        <span className="sb-user-name">{name}</span>
        <span className="sb-user-mail">
          {name.toLowerCase().replace(/\s+/g, "")}@local
        </span>
        <Icon name="chevrons-up-down" size={15} />
      </button>
      {open && (
        <div className="sb-user-menu">
          <button
            className="menu-item"
            onClick={() => {
              onOpenSettings();
              setOpen(false);
            }}
          >
            <span className="menu-ic">
              <Icon name="settings" size={15} />
            </span>
            Settings
            <span className="menu-kbd">⌘,</span>
          </button>
          <button
            className="menu-item"
            onClick={() => {
              onToggleTheme();
              setOpen(false);
            }}
          >
            <span className="menu-ic">
              <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
            </span>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="menu-sep" />
          <button className="menu-item menu-muted">
            <span className="menu-ic">
              <Icon name="log-out" size={15} />
            </span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  projects,
  route,
  onNavigate,
  onBack: _onBack,
  onForward: _onForward,
  canBack: _canBack,
  canForward: _canForward,
  onNewProject,
  onArchiveProject,
  actorName,
  onOpenSettings,
  theme,
  onToggleTheme,
  onToggleCollapse,
  width,
  onResize,
}: {
  projects: Project[];
  route: SidebarRoute;
  onNavigate: (r: SidebarRoute) => void;
  onBack: () => void;
  onForward: () => void;
  canBack: boolean;
  canForward: boolean;
  onNewProject: () => void;
  onArchiveProject: (key: string) => void;
  actorName: string;
  onOpenSettings: () => void;
  theme: string;
  onToggleTheme: () => void;
  onToggleCollapse: () => void;
  width: number;
  onResize: (w: number) => void;
}) {
  const active = projects.filter((p) => p.status === "active");
  const archived = projects.filter((p) => p.status === "archived");

  const isAll = route.kind === "all";
  const projActive = (key: string) =>
    route.kind === "project" && route.key === key;

  const [dragging, setDragging] = useState(false);
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    const onMove = (ev: PointerEvent) =>
      onResize(Math.max(208, Math.min(380, ev.clientX)));
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <aside className="sb" style={{ width: width + "px" }}>
      {/* macOS native traffic lights sit here; we add top-left padding via CSS
          to clear ~70px × the y-offset (y=18). The collapse button is the only
          interactive element in that zone. */}
      <div className="sb-winctl" data-tauri-drag-region>
        <button
          className="tb-toggle"
          onClick={onToggleCollapse}
          title="Collapse sidebar (⌘B)"
          aria-label="Collapse sidebar"
        >
          <Icon name="panel-left-close" size={16} />
        </button>
      </div>

      <div className="sb-section-label">
        <span>Workspace</span>
      </div>
      <nav className="sb-nav">
        <SbItem
          icon="layers"
          label="All threads"
          active={isAll}
          onClick={() => onNavigate({ kind: "all", tab: "board" })}
        />
      </nav>

      <div className="sb-section-label">
        <span>Projects</span>
        <button
          title="New project"
          aria-label="New project"
          onClick={onNewProject}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <nav className="sb-nav">
        {active.map((p) => (
          <SbItem
            key={p.key}
            label={p.name}
            icon={p.icon || "box"}
            active={projActive(p.key)}
            onClick={() => onNavigate({ kind: "project", key: p.key, tab: "board" })}
            action={
              <button
                className="sb-item-action"
                title="Archive project"
                aria-label="Archive project"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchiveProject(p.key);
                }}
              >
                <Icon name="archive" size={14} />
              </button>
            }
          />
        ))}
        {active.length === 0 && (
          <div className="sb-empty">No projects yet</div>
        )}
      </nav>

      {archived.length > 0 && (
        <div className="sb-section-label">
          <span>Archived</span>
        </div>
      )}
      <nav className="sb-nav">
        {archived.map((p) => (
          <div key={p.key} className="sb-archived-wrap">
            <SbItem
              label={p.name}
              icon={p.icon || "box"}
              active={projActive(p.key)}
              onClick={() => onNavigate({ kind: "project", key: p.key, tab: "board" })}
              action={
                <button
                  className="sb-item-action"
                  title="Restore project"
                  aria-label="Restore project"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArchiveProject(p.key);
                  }}
                >
                  <Icon name="archive-restore" size={14} />
                </button>
              }
            />
          </div>
        ))}
      </nav>

      <div className="sb-foot">
        <UserMenu
          theme={theme}
          onToggleTheme={onToggleTheme}
          actorName={actorName}
          onOpenSettings={onOpenSettings}
        />
      </div>

      <div
        className={"sb-resize" + (dragging ? " is-dragging" : "")}
        onPointerDown={startResize}
        title="Drag to resize"
      />
    </aside>
  );
}
