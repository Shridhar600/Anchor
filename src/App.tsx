/* Anchor — app shell. Full-height sidebar, content column with topbar + header.
   Data comes from the Tauri backend via src/lib/api.ts.
   macOS native traffic lights (titleBarStyle: Overlay) replace the prototype's fake dots.
   Drag region: sidebar header and topbar background carry data-tauri-drag-region. */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Icon, TYPE_TONE, toneBg, fmtTime } from "./lib/ui";
import { COLUMNS, TYPE_META } from "./lib/meta";
import { repoLabel, pathLabel } from "./lib/format";
import * as api from "./lib/api";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { platform } from "./lib/platform";
import { WindowControls } from "./components/WindowControls";
import type {
  Project,
  Thread,
  Resource,
  ThreadStatus,
  NoteKind,
  ResourceType,
} from "./lib/types";

const DRAFT_TICKET = "__draft__";

import { Sidebar } from "./components/Sidebar";
import { Board } from "./components/Board";
import { DetailPanel } from "./components/DetailPanel";
import { ProjectOverview } from "./components/ProjectOverview";
import { CommandPalette } from "./components/CommandPalette";
import { CreateProject } from "./components/CreateProject";
import { Onboarding } from "./components/Onboarding";
import {
  ToastHost,
  ConfirmDialog,
  ShortcutSheet,
  pushToast,
} from "./components/Overlays";
import { SettingsModal, loadSettings, FONT_STACKS } from "./components/Settings";
import type { AppSettings } from "./components/Settings";
import {
  SkeletonBoard,
  SkeletonList,
  SkeletonOverview,
  InlineError,
} from "./components/States";

const PRIO_RANK: Record<string, number> = { high: 3, med: 2, low: 1 };
const lastActivity = (t: Thread) =>
  t.notes.reduce((m, n) => Math.max(m, new Date(n.at).getTime()), 0);

interface Route {
  kind: "project" | "all" | "new-project";
  key?: string;
  tab?: "board" | "list" | "overview";
}

interface ConfirmOpts {
  title: string;
  body: string;
  confirmLabel: string;
  danger: boolean;
  onConfirm: () => void;
}

function Menu({
  open,
  onClose,
  children,
  width,
  align,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="menu"
      ref={ref}
      style={{
        width,
        right: align === "right" ? 0 : undefined,
        left: align === "right" ? "auto" : undefined,
      }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const setSetting = useCallback(
    <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
      setSettings((s) => ({ ...s, [k]: v })),
    []
  );

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("anchor-sb") === "1"
  );
  const [sbWidth, setSbWidth] = useState(
    () => +(localStorage.getItem("anchor-sb-w") || 248)
  );

  // ---- data state ----
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  // Project-level resources are embedded inside projects; we maintain a separate
  // flat list for project resources (not thread-scoped) to match prototype shape.
  const [projectResources, setProjectResources] = useState<Resource[]>([]);
  const [dataLoadState, setDataLoadState] = useState<"loading" | "ready" | "error">("loading");

  const [route, setRoute] = useState<Route>({ kind: "project", key: "ANCHOR", tab: "board" });
  const [past, setPast] = useState<Route[]>([]);
  const [future, setFuture] = useState<Route[]>([]);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [draft, setDraft] = useState<Thread | null>(null);
  const [full, setFull] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmOpts | null>(null);
  const [dpState, setDpState] = useState<"loading" | "ready" | "error">("ready");

  const [sort, setSort] = useState<"manual" | "priority" | "recent">("manual");
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [toolMenu, setToolMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const newThreadRef = useRef<((status?: ThreadStatus) => void) | null>(null);
  const goBackRef = useRef<(() => void) | null>(null);
  const goForwardRef = useRef<(() => void) | null>(null);

  // ---- apply settings to DOM ----
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", settings.theme);
    r.setAttribute("data-density", settings.density);
    r.style.setProperty("--accent", settings.accent);
    r.style.setProperty(
      "--accent-hover",
      `color-mix(in srgb, ${settings.accent} 86%, #000)`
    );
    r.style.setProperty(
      "--accent-soft",
      `color-mix(in srgb, ${settings.accent} 14%, transparent)`
    );
    r.style.setProperty("--font-sans", FONT_STACKS[settings.typeface] || "");
    localStorage.setItem("anchor-settings", JSON.stringify(settings));
  }, [settings]);

  // ---- set data-platform on <html> once ----
  useEffect(() => {
    document.documentElement.setAttribute("data-platform", platform);
  }, []);

  useEffect(() => {
    localStorage.setItem("anchor-sb", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    localStorage.setItem("anchor-sb-w", String(sbWidth));
  }, [sbWidth]);

  // ---- initial data load ----
  useEffect(() => {
    setDataLoadState("loading");
    Promise.all([api.listProjects(), api.listThreads()])
      .then(([projs, thrs]) => {
        setProjects(projs);
        setThreads(thrs);
        // set sensible default route to first active project
        if (projs.length > 0) {
          setRoute({ kind: "project", key: projs[0].key, tab: "board" });
        } else {
          setRoute({ kind: "all", tab: "board" });
        }
        setDataLoadState("ready");
      })
      .catch((e) => {
        console.error("data load failed", e);
        setDataLoadState("error");
      });
  }, []);

  // Only show the loading skeleton if the (local, usually sub-50ms) load actually
  // takes a moment — otherwise content appears directly and we avoid a jarring
  // skeleton→content flash on every launch.
  const [showLoadSkeleton, setShowLoadSkeleton] = useState(false);
  useEffect(() => {
    if (dataLoadState !== "loading") {
      setShowLoadSkeleton(false);
      return;
    }
    const id = setTimeout(() => setShowLoadSkeleton(true), 150);
    return () => clearTimeout(id);
  }, [dataLoadState]);

  // ---- native window drag ----
  // WKWebView ignores `-webkit-app-region`, and Tauri's built-in
  // data-tauri-drag-region only inspects event.target (not ancestors). This
  // handler walks ancestors via closest() so the whole topbar / sidebar header
  // drags, while interactive elements opt out.
  useEffect(() => {
    const NO_DRAG =
      'button, a, input, select, textarea, [role="button"], .menu, .act-wrap';
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target || target.closest(NO_DRAG)) return;
      if (target.closest("[data-tauri-drag-region]")) {
        getCurrentWindow()
          .startDragging()
          .catch(() => {});
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (newThreadRef.current) newThreadRef.current();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        if (goBackRef.current) goBackRef.current();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        if (goForwardRef.current) goForwardRef.current();
      } else if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      } else if (e.key === "Escape") {
        if (settingsOpen || shortcutsOpen || confirm) return;
        if (paletteOpen) setPaletteOpen(false);
        else if (statusMenuOpen) setStatusMenuOpen(false);
        else if (openTicket) {
          if (openTicket === DRAFT_TICKET) setDraft(null);
          setOpenTicket(null);
          setFull(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, statusMenuOpen, openTicket, settingsOpen, shortcutsOpen, confirm]);

  // ---- derived state ----
  const activeProjects = projects.filter((p) => p.status === "active");
  const isAll = route.kind === "all";
  const isCreate = route.kind === "new-project";
  const project = !isAll && !isCreate ? (projects.find((p) => p.key === route.key) ?? null) : null;
  const tab = route.tab ?? "board";

  const scopeThreads = useMemo(
    () => (isAll ? threads : project ? threads.filter((t) => t.project === project.key) : []),
    [threads, isAll, project]
  );

  const visibleThreads = useMemo(() => {
    let list = scopeThreads;
    if (typeFilter.length) list = list.filter((t) => typeFilter.includes(t.type));
    if (sort === "priority")
      list = [...list].sort((a, b) => PRIO_RANK[b.priority] - PRIO_RANK[a.priority]);
    else if (sort === "recent")
      list = [...list].sort((a, b) => lastActivity(b) - lastActivity(a));
    return list;
  }, [scopeThreads, typeFilter, sort]);

  const filtersActive = typeFilter.length > 0;
  const projUpdated = scopeThreads.length
    ? Math.max(...scopeThreads.map(lastActivity))
    : 0;
  const openThread =
    openTicket === DRAFT_TICKET
      ? draft
      : (threads.find((t) => t.ticket === openTicket) ?? null);
  const openThreadProject = openThread
    ? (projects.find((p) => p.key === openThread.project) ?? null)
    : null;

  // ---- navigation ----
  const navigate = useCallback((r: Route) => {
    setPast((p) => [...p, route].slice(-50));
    setFuture([]);
    setRoute(r);
    setOpenTicket(null);
    setDraft(null);
    setFull(false);
    setToolMenu(null);
  }, [route]);

  const setTab = useCallback(
    (t: "board" | "list" | "overview") => navigate({ ...route, tab: t }),
    [navigate, route]
  );

  const canBack = past.length > 0;
  const canForward = future.length > 0;

  const goBack = useCallback(() => {
    if (!past.length) return;
    setFuture((f) => [route, ...f]);
    setRoute(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setOpenTicket(null);
    setDraft(null);
    setFull(false);
    setToolMenu(null);
  }, [past, route]);

  const goForward = useCallback(() => {
    if (!future.length) return;
    setPast((p) => [...p, route]);
    setRoute(future[0]);
    setFuture((f) => f.slice(1));
    setOpenTicket(null);
    setDraft(null);
    setFull(false);
    setToolMenu(null);
  }, [future, route]);

  goBackRef.current = goBack;
  goForwardRef.current = goForward;

  const fail = (message: string) => pushToast({ kind: "error", message });

  // ---- mutations (optimistic + backend reconcile) ----
  const moveStatus = useCallback((ticket: string, status: ThreadStatus) => {
    // optimistic
    setThreads((ts) =>
      ts.map((t) => (t.ticket === ticket ? { ...t, status } : t))
    );
    setStatusMenuOpen(false);
    api.moveThread(ticket, status).catch((e) => {
      fail(`Couldn't move ${ticket}: ${String(e)}`);
      // revert (re-fetch would be ideal, but just warn for now — the next mount resyncs)
    });
  }, []);

  const handleAppendNote = useCallback(
    (
      ticket: string,
      n: { author: "user"; kind: NoteKind; body: string; at: string }
    ) => {
      api
        .appendNote({
          ticket,
          kind: n.kind,
          body: n.body,
          author: n.author,
          author_name: settingsRef.current.actorName || null,
        })
        .then((note) => {
          setThreads((ts) =>
            ts.map((t) =>
              t.ticket === ticket ? { ...t, notes: [...t.notes, note] } : t
            )
          );
        })
        .catch((e) => fail(`Couldn't append to the log: ${String(e)}`));
    },
    []
  );

  const handleAddThreadResource = useCallback(
    (ticket: string, res: { type: ResourceType; label: string; value: string }) => {
      const proj = threads.find((t) => t.ticket === ticket)?.project ?? "";
      api
        .addResource({ project: proj, thread: ticket, ...res })
        .then((resource) => {
          setThreads((ts) =>
            ts.map((t) =>
              t.ticket === ticket
                ? { ...t, resources: [...t.resources, resource] }
                : t
            )
          );
        })
        .catch((e) => fail(`Couldn't attach resource: ${String(e)}`));
    },
    [threads]
  );

  const handleDeleteThreadResource = useCallback((ticket: string, r: Resource) => {
    api
      .deleteResource(r.id)
      .then(() => {
        setThreads((ts) =>
          ts.map((t) =>
            t.ticket === ticket
              ? { ...t, resources: t.resources.filter((x) => x.id !== r.id) }
              : t
          )
        );
      })
      .catch((e) => fail(`Couldn't remove resource: ${String(e)}`));
  }, []);

  const handleAddProjectResource = useCallback(
    (key: string, res: { type: ResourceType; label: string; value: string }) => {
      api
        .addResource({ project: key, thread: null, ...res })
        .then((resource) => {
          setProjectResources((rs) => [...rs, resource]);
        })
        .catch((e) => fail(`Couldn't attach resource: ${String(e)}`));
    },
    []
  );

  const handleDeleteProjectResource = useCallback((r: Resource) => {
    api
      .deleteResource(r.id)
      .then(() => {
        setProjectResources((rs) => rs.filter((x) => x.id !== r.id));
      })
      .catch((e) => fail(`Couldn't remove resource: ${String(e)}`));
  }, []);

  const handleDeleteThread = useCallback((ticket: string) => {
    api
      .deleteThread(ticket)
      .then(() => {
        setThreads((ts) => ts.filter((t) => t.ticket !== ticket));
        setOpenTicket(null);
        setFull(false);
        setStatusMenuOpen(false);
        pushToast({ kind: "success", message: `${ticket} deleted` });
      })
      .catch((e) => fail(`Couldn't delete ${ticket}: ${String(e)}`));
  }, []);

  const askConfirm = useCallback((opts: ConfirmOpts) => setConfirm(opts), []);

  const confirmDeleteThread = useCallback(
    (ticket: string) =>
      askConfirm({
        title: `Delete ${ticket}?`,
        body: "This removes the thread and its note log. This can't be undone.",
        confirmLabel: "Delete",
        danger: true,
        onConfirm: () => handleDeleteThread(ticket),
      }),
    [askConfirm, handleDeleteThread]
  );

  const confirmDeleteThreadResource = useCallback(
    (ticket: string, r: Resource) =>
      askConfirm({
        title: "Remove resource?",
        body: `"${r.label}" will be detached from ${ticket}.`,
        confirmLabel: "Remove",
        danger: true,
        onConfirm: () => handleDeleteThreadResource(ticket, r),
      }),
    [askConfirm, handleDeleteThreadResource]
  );

  const confirmDeleteProjectResource = useCallback(
    (r: Resource) =>
      askConfirm({
        title: "Remove resource?",
        body: `"${r.label}" will be detached from this project.`,
        confirmLabel: "Remove",
        danger: true,
        onConfirm: () => handleDeleteProjectResource(r),
      }),
    [askConfirm, handleDeleteProjectResource]
  );

  const handleSaveDescription = useCallback((ticket: string, description: string) => {
    // optimistic
    setThreads((ts) =>
      ts.map((t) => (t.ticket === ticket ? { ...t, description } : t))
    );
    api
      .updateThread({ ticket, description })
      .then((updated) => {
        setThreads((ts) => ts.map((t) => (t.ticket === ticket ? updated : t)));
      })
      .catch((e) => fail(`Couldn't save description: ${String(e)}`));
  }, []);

  const handleSaveTitle = useCallback((ticket: string, title: string) => {
    setThreads((ts) =>
      ts.map((t) => (t.ticket === ticket ? { ...t, title } : t))
    );
    api
      .updateThread({ ticket, title })
      .then((updated) => {
        setThreads((ts) => ts.map((t) => (t.ticket === ticket ? updated : t)));
      })
      .catch((e) => fail(`Couldn't save title: ${String(e)}`));
  }, []);

  const handleCreateProject = useCallback(
    (p: Project) => {
      api
        .createProject({
          key: p.key,
          name: p.name,
          icon: p.icon,
          description: p.description,
          path: p.path,
          remote: p.remote,
        })
        .then((created) => {
          setProjects((ps) => [created, ...ps]);
          navigate({ kind: "project", key: created.key, tab: "overview" });
        })
        .catch((e) => fail(`Couldn't create project: ${String(e)}`));
    },
    [navigate]
  );

  const handleSaveProject = useCallback(
    (key: string, patch: Partial<Pick<Project, "name" | "description" | "icon" | "path" | "remote">>) => {
      setProjects((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
      api
        .updateProject({ key, ...patch })
        .then((updated) => {
          setProjects((ps) => ps.map((p) => (p.key === key ? updated : p)));
        })
        .catch((e) => fail(`Couldn't save project: ${String(e)}`));
    },
    []
  );

  const toggleArchiveProject = useCallback((key: string) => {
    const p = projects.find((x) => x.key === key);
    if (!p) return;
    const nextStatus = p.status === "archived" ? "active" : "archived";
    setProjects((ps) =>
      ps.map((x) => (x.key === key ? { ...x, status: nextStatus } : x))
    );
    api
      .setProjectStatus(key, nextStatus)
      .then((updated) => {
        setProjects((ps) => ps.map((x) => (x.key === key ? updated : x)));
      })
      .catch((e) => fail(`Couldn't update project: ${String(e)}`));
  }, [projects]);

  const handleCreateThread = useCallback(
    (status: ThreadStatus = "backlog") => {
      // If a draft already exists, re-open it (no second draft)
      if (draft) {
        setOpenTicket(DRAFT_TICKET);
        return;
      }
      const proj = project || activeProjects[0];
      if (!proj) return;
      const newDraft: Thread = {
        ticket: DRAFT_TICKET,
        project: proj.key,
        title: "",
        description: "",
        type: "feature",
        status,
        priority: "med",
        branch: null,
        notes: [],
        resources: [],
      };
      setDraft(newDraft);
      if (route.kind === "project" && route.tab === "overview") {
        setTab("board");
      }
      setOpenTicket(DRAFT_TICKET);
      setFull(false);
      setStatusMenuOpen(false);
    },
    [draft, project, activeProjects, route, setTab]
  );
  newThreadRef.current = handleCreateThread;

  // Update draft fields locally (no backend call)
  const handleUpdateDraft = useCallback(
    (patch: Partial<Pick<Thread, "title" | "description" | "type" | "priority" | "status" | "branch">>) => {
      setDraft((d) => (d ? { ...d, ...patch } : d));
    },
    []
  );

  // Commit the draft: persist via api.createThread once a non-empty title is saved
  const handleCommitDraft = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed || !draft) return; // empty title — keep editing
      try {
        const created = await api.createThread({
          project: draft.project,
          title: trimmed,
          type: draft.type,
          status: draft.status,
          priority: draft.priority,
          branch: draft.branch,
        });
        setThreads((ts) => [...ts, created]);
        setDraft(null);
        setOpenTicket(created.ticket);
        if (draft.description.trim()) {
          // Best-effort follow-up; failure is non-fatal for the commit
          api.updateThread({ ticket: created.ticket, description: draft.description }).then(
            (updated) => {
              setThreads((ts) => ts.map((t) => (t.ticket === created.ticket ? updated : t)));
            },
            (e) => fail(`Couldn't save description: ${String(e)}`)
          );
        }
      } catch (e) {
        fail(`Couldn't create thread: ${String(e)}`);
        // keep draft open
      }
    },
    [draft]
  );

  const retryLoad = () => {
    setDataLoadState("loading");
    Promise.all([api.listProjects(), api.listThreads()])
      .then(([projs, thrs]) => {
        setProjects(projs);
        setThreads(thrs);
        setDataLoadState("ready");
      })
      .catch(() => setDataLoadState("error"));
  };

  const retryThread = () => {
    setDpState("ready");
  };

  // Thread detail opens instantly — the thread (with its notes + resources) is
  // already in memory from the initial load, so there's nothing to fetch. No
  // artificial skeleton (it only broke immersion on a local-first app).

  const openOverview = (key: string) => {
    navigate({ kind: "project", key, tab: "overview" });
    setPaletteOpen(false);
  };
  const openFromPalette = (ticket: string) => {
    setOpenTicket(ticket);
    setPaletteOpen(false);
  };

  const SORT_LABEL: Record<string, string> = {
    manual: "Manual",
    priority: "Priority",
    recent: "Recently updated",
  };
  const toggleType = (t: string) =>
    setTypeFilter((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]));

  const showOnboarding = activeProjects.length === 0 && !isCreate;
  const projectCount = activeProjects.length;

  const dbInfo = {
    path: "~/Library/Application Support/Anchor/anchor.db",
    projects: projects.length,
    threads: threads.length,
    notes: threads.reduce((n, t) => n + t.notes.length, 0),
  };

  const showConsole = !isCreate && tab !== "overview";
  void showConsole; // not used in render but kept for structural parity

  return (
    <div className="win">
      {!collapsed && (
        <Sidebar
          projects={projects}
          route={route}
          onNavigate={navigate}
          onBack={goBack}
          onForward={goForward}
          canBack={canBack}
          canForward={canForward}
          onNewProject={() => navigate({ kind: "new-project" })}
          onArchiveProject={toggleArchiveProject}
          actorName={settings.actorName}
          onOpenSettings={() => setSettingsOpen(true)}
          theme={settings.theme}
          onToggleTheme={() =>
            setSetting("theme", settings.theme === "dark" ? "light" : "dark")
          }
          onToggleCollapse={() => setCollapsed(true)}
          width={sbWidth}
          onResize={setSbWidth}
        />
      )}

      <div className="rightcol">
        {/* macOS titlebar drag region — no fake traffic lights.
            When sidebar is collapsed the native lights overlay the topbar-left;
            we inset with CSS class .topbar-left--sb-off (added in anchor.css). */}
        <div className="topbar" data-tauri-drag-region>
          <div className={"topbar-left" + (collapsed ? " topbar-left--sb-off" : "")}>
            {collapsed && (
              <div className="winctl">
                {/* REMOVED: fake tb-lights dots (native traffic lights are real) */}
                <button
                  className="tb-toggle"
                  onClick={() => setCollapsed(false)}
                  title="Open sidebar (⌘B)"
                  aria-label="Open sidebar"
                >
                  <Icon name="panel-left-open" size={16} />
                </button>
              </div>
            )}

            {!isCreate && !showOnboarding && (
              <div className="tb-navctl">
                <button
                  className="tb-toggle"
                  onClick={goBack}
                  disabled={!canBack}
                  title="Back (⌘[)"
                  aria-label="Back"
                >
                  <Icon name="chevron-left" size={18} />
                </button>
                <button
                  className="tb-toggle"
                  onClick={goForward}
                  disabled={!canForward}
                  title="Forward (⌘])"
                  aria-label="Forward"
                >
                  <Icon name="chevron-right" size={18} />
                </button>
              </div>
            )}

            {!isCreate && !showOnboarding && (
              <div className="ident">
                {isAll ? (
                  <>
                    <span className="ident-ic">
                      <Icon name="layers" size={17} />
                    </span>
                    <span className="ident-name ident-name--static">
                      All threads
                    </span>
                    <span className="ident-meta">
                      {scopeThreads.length} across {projectCount} projects
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      className={
                        "ident-name" +
                        (tab === "overview" ? " is-active" : "")
                      }
                      onClick={() =>
                        setTab(tab === "overview" ? "board" : "overview")
                      }
                      title={
                        tab === "overview"
                          ? "Back to board"
                          : "Open project overview"
                      }
                    >
                      {project?.name}
                      <Icon
                        name={
                          tab === "overview" ? "layout-grid" : "arrow-up-right"
                        }
                        size={13}
                        className="ident-name-go"
                      />
                    </button>
                    {project?.status === "archived" ? (
                      <span className="ident-archived">Archived</span>
                    ) : projUpdated > 0 ? (
                      <span className="ident-meta">
                        Updated {fmtTime(new Date(projUpdated).toISOString())}
                      </span>
                    ) : null}
                    {!isAll &&
                      tab !== "overview" &&
                      project?.description && (
                        <button
                          className={
                            "ident-expand" + (descOpen ? " is-open" : "")
                          }
                          onClick={() => setDescOpen((o) => !o)}
                          title={
                            descOpen ? "Hide details" : "Show project details"
                          }
                          aria-label="Toggle project details"
                        >
                          <Icon name="chevron-down" size={15} />
                        </button>
                      )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="topbar-spacer" />

          {!isCreate && !showOnboarding && (
            <div className="tb-actions">
              <button
                className={"search" + (searchOpen ? " is-open" : "")}
                onMouseEnter={() => setSearchOpen(true)}
                onMouseLeave={() => setSearchOpen(false)}
                onClick={() => setPaletteOpen(true)}
                title="Search (⌘K)"
                aria-label="Search"
              >
                <Icon name="search" size={16} />
                <span className="search-label">
                  Search threads, jump to a project…{" "}
                  <kbd>⌘K</kbd>
                </span>
              </button>

              <span className="tb-sep" />

              <div className="vswitch" role="tablist" aria-label="Board or list view">
                <button
                  className={
                    "vswitch-opt" +
                    (!isAll && tab === "overview"
                      ? ""
                      : tab !== "list"
                      ? " is-on"
                      : "")
                  }
                  onClick={() => setTab("board")}
                  title="Board"
                  aria-label="Board view"
                >
                  <Icon name="layout-grid" size={15} />
                  <span className="vswitch-label">Board</span>
                </button>
                <button
                  className={"vswitch-opt" + (tab === "list" ? " is-on" : "")}
                  onClick={() => setTab("list")}
                  title="List"
                  aria-label="List view"
                >
                  <Icon name="list" size={15} />
                  <span className="vswitch-label">List</span>
                </button>
                <span
                  className="vswitch-thumb"
                  style={{
                    transform:
                      tab === "list"
                        ? "translateX(100%)"
                        : "translateX(0)",
                    opacity:
                      !isAll && tab === "overview" ? 0 : 1,
                  }}
                />
              </div>

              <div className="act-wrap">
                <button
                  className={"act" + (toolMenu === "tools" ? " is-open" : "")}
                  onClick={() =>
                    setToolMenu((m) => (m === "tools" ? null : "tools"))
                  }
                  title="Filter & sort"
                  aria-label="Filter and sort"
                >
                  <Icon name="sliders-horizontal" size={16} />
                  <span className="act-label">View</span>
                  {(filtersActive || sort !== "manual") && (
                    <span className="act-dot" />
                  )}
                </button>
                <Menu
                  open={toolMenu === "tools"}
                  onClose={() => setToolMenu(null)}
                  width="224px"
                  align="right"
                >
                  <div className="menu-label">Order by</div>
                  {(["manual", "priority", "recent"] as const).map((s) => (
                    <button
                      key={s}
                      className="menu-item"
                      onClick={() => setSort(s)}
                    >
                      <span className="menu-check">
                        {sort === s && (
                          <Icon
                            name="check"
                            size={13}
                            style={{ color: "var(--accent)" }}
                          />
                        )}
                      </span>
                      <span className="cp-item-title">{SORT_LABEL[s]}</span>
                    </button>
                  ))}
                  <div className="menu-sep" />
                  <div className="menu-label">Filter by type</div>
                  {Object.keys(TYPE_META).map((tp) => {
                    const typedTp = tp as keyof typeof TYPE_META;
                    return (
                      <button
                        key={tp}
                        className="menu-item"
                        onClick={() => toggleType(tp)}
                      >
                        <span className="menu-check">
                          {typeFilter.includes(tp) && (
                            <Icon
                              name="check"
                              size={13}
                              style={{ color: "var(--accent)" }}
                            />
                          )}
                        </span>
                        <span
                          className="attr-type-ic"
                          style={toneBg(TYPE_TONE[typedTp])}
                        >
                          <Icon name={TYPE_META[typedTp].icon} size={12} />
                        </span>
                        <span className="cp-item-title">
                          {TYPE_META[typedTp].label}
                        </span>
                      </button>
                    );
                  })}
                  {(filtersActive || sort !== "manual") && (
                    <button
                      className="menu-item menu-clear"
                      onClick={() => {
                        setTypeFilter([]);
                        setSort("manual");
                      }}
                    >
                      Reset view{" "}
                      {filtersActive
                        ? `· ${visibleThreads.length}/${scopeThreads.length}`
                        : ""}
                    </button>
                  )}
                </Menu>
              </div>
            </div>
          )}
          <WindowControls />
        </div>

        {!isAll && !isCreate && !showOnboarding && tab !== "overview" && project?.description && (
          <div className={"proj-desc" + (descOpen ? " is-open" : "")}>
            <div className="proj-desc-inner">
              <p className="proj-desc-text">{project.description}</p>
            </div>
          </div>
        )}

        <main className="main">
          {isCreate ? (
            <CreateProject
              onCancel={() =>
                navigate(
                  activeProjects.length
                    ? { kind: "project", key: activeProjects[0].key, tab: "board" }
                    : { kind: "all", tab: "board" }
                )
              }
              onCreate={handleCreateProject}
              existingKeys={projects.map((p) => p.key)}
            />
          ) : showOnboarding ? (
            <Onboarding
              onCreate={() => navigate({ kind: "new-project" })}
              onImport={() => navigate({ kind: "new-project" })}
            />
          ) : (
            <>
              {dataLoadState === "error" ? (
                <InlineError onRetry={retryLoad} />
              ) : dataLoadState === "loading" ? (
                !showLoadSkeleton ? null : tab === "overview" && !isAll ? (
                  <SkeletonOverview />
                ) : tab === "list" ? (
                  <SkeletonList />
                ) : (
                  <SkeletonBoard columns={COLUMNS} />
                )
              ) : tab === "overview" && !isAll ? (
                project && (
                  <ProjectOverview
                    project={project}
                    threads={scopeThreads}
                    projectResources={projectResources}
                    columns={COLUMNS}
                    onOpenThread={(t) => {
                      setOpenTicket(t);
                      setStatusMenuOpen(false);
                    }}
                    onSaveProject={handleSaveProject}
                    onNewThread={handleCreateThread}
                    onAddResource={(res) =>
                      handleAddProjectResource(project.key, res)
                    }
                    onDeleteProjectResource={confirmDeleteProjectResource}
                    onDeleteThreadResource={(ticket, r) =>
                      confirmDeleteThreadResource(ticket, r)
                    }
                  />
                )
              ) : (
                <Board
                  threads={visibleThreads}
                  columns={COLUMNS}
                  view={tab === "list" ? "list" : "board"}
                  sortActive={sort !== "manual"}
                  filtersActive={filtersActive}
                  isAll={isAll}
                  selectedTicket={openTicket}
                  onOpenThread={(t) => {
                    setOpenTicket(t);
                    setStatusMenuOpen(false);
                  }}
                  onMove={moveStatus}
                  onNewThread={handleCreateThread}
                />
              )}

              <footer className="appfoot">
                <div className="statusbar">
                  {isAll ? (
                    <>
                      <span className="sb-seg sb-muted">
                        <Icon name="layers" size={12} />
                        {scopeThreads.length} threads · {projectCount} projects
                      </span>
                    </>
                  ) : project ? (
                    <>
                      {project.branch ? (
                        <span
                          className="sb-seg sb-muted"
                          title={project.branch}
                        >
                          <Icon name="git-branch" size={12} />
                          {project.branch}
                        </span>
                      ) : null}
                      {project.remote ? (
                        <button
                          className="sb-seg sb-act"
                          title={project.remote}
                          onClick={() => {
                            const raw = project.remote.trim();
                            if (!raw) return;
                            const url = /^https?:\/\//.test(raw)
                              ? raw
                              : `https://${raw}`;
                            openUrl(url).catch((e) =>
                              fail(`Couldn't open URL: ${String(e)}`)
                            );
                          }}
                        >
                          <Icon name="globe" size={12} />
                          {repoLabel(project.remote)}
                        </button>
                      ) : null}
                      {project.path ? (
                        <button
                          className="sb-seg sb-act"
                          title={project.path}
                          onClick={() => {
                            if (!project.path) return;
                            revealItemInDir(project.path).catch((e) =>
                              fail(`Couldn't reveal in Finder: ${String(e)}`)
                            );
                          }}
                        >
                          <Icon name="folder" size={12} />
                          {pathLabel(project.path)}
                        </button>
                      ) : !project.remote && !project.branch ? (
                        <span className="sb-seg sb-muted">
                          Ideation · no repo linked
                        </span>
                      ) : null}
                    </>
                  ) : null}
                  <span className="sb-spacer" />
                  <span className="sb-seg sb-sync sb-muted">
                    <span className="sb-sync-dot" />
                    Saved locally
                  </span>
                </div>
              </footer>
            </>
          )}

          {openThread && (
            <div
              className="dp-scrim"
              onClick={() => {
                if (openTicket === DRAFT_TICKET) setDraft(null);
                setOpenTicket(null);
                setFull(false);
                setStatusMenuOpen(false);
              }}
            >
              <DetailPanel
                project={openThreadProject}
                thread={openThread}
                columns={COLUMNS}
                full={full}
                loading={dpState === "loading"}
                error={dpState === "error"}
                onRetry={retryThread}
                actorName={settings.actorName}
                isDraft={openTicket === DRAFT_TICKET}
                onClose={() => {
                  if (openTicket === DRAFT_TICKET) setDraft(null);
                  setOpenTicket(null);
                  setFull(false);
                  setStatusMenuOpen(false);
                }}
                onToggleFull={() => setFull((f) => !f)}
                onMoveStatus={(ticket, status) => {
                  if (openTicket === DRAFT_TICKET) {
                    handleUpdateDraft({ status });
                  } else {
                    moveStatus(ticket, status);
                  }
                }}
                onAppendNote={handleAppendNote}
                onSaveDescription={(ticket, description) => {
                  if (openTicket === DRAFT_TICKET) {
                    handleUpdateDraft({ description });
                  } else {
                    handleSaveDescription(ticket, description);
                  }
                }}
                onSaveTitle={(ticket, title) => {
                  if (openTicket === DRAFT_TICKET) {
                    handleCommitDraft(title);
                  } else {
                    handleSaveTitle(ticket, title);
                  }
                }}
                onAddResource={(res) =>
                  handleAddThreadResource(openThread.ticket, res)
                }
                onDeleteResource={(r) =>
                  confirmDeleteThreadResource(openThread.ticket, r)
                }
                onDeleteThread={() => {
                  if (openTicket === DRAFT_TICKET) {
                    setDraft(null);
                    setOpenTicket(null);
                    setFull(false);
                  } else {
                    confirmDeleteThread(openThread.ticket);
                  }
                }}
                onOpenStatusMenu={() =>
                  setStatusMenuOpen((s) => !s)
                }
                statusMenuOpen={statusMenuOpen}
              />
            </div>
          )}
        </main>
      </div>

      {paletteOpen && (
        <CommandPalette
          threads={threads}
          projects={activeProjects}
          columns={COLUMNS}
          onClose={() => setPaletteOpen(false)}
          onJump={openFromPalette}
          onCreate={() => {
            setPaletteOpen(false);
            handleCreateThread();
          }}
          onOpenOverview={openOverview}
          onMoveStatus={(ticket, status) => {
            moveStatus(ticket, status);
            setPaletteOpen(false);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onChange={setSetting}
          onClose={() => setSettingsOpen(false)}
          dbInfo={dbInfo}
        />
      )}
      <ShortcutSheet
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        body={confirm?.body}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const a = confirm;
          setConfirm(null);
          if (a) a.onConfirm();
        }}
      />
      <ToastHost />
    </div>
  );
}
