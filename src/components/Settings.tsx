/* Anchor — Settings modal. Appearance · Account · Data · Developer sections.
   Visual settings (theme/density/accent/typeface) live in localStorage.
   The actor name is synced to the backend via setSettings(). */
import { useState, useEffect } from "react";
import { Icon } from "../lib/ui";
import { pushToast } from "./Overlays";

// Family names must match the self-hosted @fontsource-variable faces:
// "Geist Variable", "Inter Variable" (imported in src/main.tsx). SF Pro Rounded
// was dropped (Apple-licensed, not bundled).
export const FONT_STACKS: Record<string, string> = {
  "System (SF Pro)":
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Inter Variable', sans-serif",
  Geist:
    "'Geist Variable', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  Inter:
    "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export interface AppSettings {
  theme: "dark" | "light";
  density: "compact" | "default" | "roomy";
  accent: string;
  typeface: string;
  actorName: string;
  devState: "auto" | "loading" | "error";
  devFail: boolean;
}

export const SETTINGS_DEFAULTS: AppSettings = {
  theme: "dark",
  density: "compact",
  accent: "#6587D8",
  typeface: "Geist",
  actorName: "Shridhar",
  devState: "auto",
  devFail: false,
};

export function loadSettings(): AppSettings {
  let s: Partial<AppSettings> = {};
  try {
    s = JSON.parse(localStorage.getItem("anchor-settings") || "{}");
  } catch (_) {
    // ignore
  }
  // legacy key migration
  if (!s.theme) {
    const legacy = localStorage.getItem("anchor-theme");
    if (legacy === "dark" || legacy === "light") s.theme = legacy;
  }
  return { ...SETTINGS_DEFAULTS, ...s };
}

const FONT_OPTIONS = ["System (SF Pro)", "Geist", "Inter"];
const ACCENT_OPTIONS = [
  { value: "#6587D8", name: "Blue" },
  { value: "#5E8B7E", name: "Green" },
  { value: "#C0894F", name: "Amber" },
  { value: "#8E7BD0", name: "Violet" },
];

function SetRow({
  label,
  hint,
  children,
  stacked,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div className={"set-row" + (stacked ? " is-stacked" : "")}>
      <div className="set-row-text">
        <div className="set-row-label">{label}</div>
        {hint && <div className="set-row-hint">{hint}</div>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  );
}

function SetSeg({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string; icon?: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="set-seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          className={"set-seg-opt" + (value === o.value ? " is-on" : "")}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const SETTINGS_NAV = [
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "account", label: "Account", icon: "user-round" },
  { id: "data", label: "Data", icon: "database" },
  { id: "developer", label: "Developer", icon: "flask-conical" },
] as const;

type SettingsSection = (typeof SETTINGS_NAV)[number]["id"];

function AppearancePanel({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
}) {
  return (
    <>
      <SetRow label="Theme">
        <SetSeg
          value={settings.theme}
          onChange={(v) => onChange("theme", v as AppSettings["theme"])}
          options={[
            { value: "dark", label: "Dark", icon: "moon" },
            { value: "light", label: "Light", icon: "sun" },
          ]}
        />
      </SetRow>
      <SetRow label="Accent" hint="Used for primary actions and selection">
        <div className="set-swatches">
          {ACCENT_OPTIONS.map((a) => (
            <button
              key={a.value}
              title={a.name}
              aria-label={a.name}
              className={"set-swatch" + (settings.accent === a.value ? " is-on" : "")}
              style={{ background: a.value }}
              onClick={() => onChange("accent", a.value)}
            >
              {settings.accent === a.value && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      </SetRow>
      <SetRow label="Interface font">
        <select
          className="set-select"
          value={settings.typeface}
          onChange={(e) => onChange("typeface", e.target.value)}
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </SetRow>
      <SetRow label="Density">
        <SetSeg
          value={settings.density}
          onChange={(v) => onChange("density", v as AppSettings["density"])}
          options={[
            { value: "compact", label: "Compact" },
            { value: "default", label: "Default" },
            { value: "roomy", label: "Roomy" },
          ]}
        />
      </SetRow>
    </>
  );
}

function AccountPanel({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
}) {
  const name = (settings.actorName || "You").trim() || "You";
  return (
    <>
      <div className="set-identity">
        <span className="set-identity-av">{name.charAt(0).toUpperCase()}</span>
        <div className="set-identity-meta">
          <div className="set-identity-name">{name}</div>
          <div className="set-identity-mail mono">
            {name.toLowerCase().replace(/\s+/g, "")}@local
          </div>
        </div>
      </div>
      <SetRow
        label="Your name"
        hint="Shown as the author of notes you write and in the audit log"
        stacked
      >
        <input
          className="field-input"
          value={settings.actorName}
          onChange={(e) => onChange("actorName", e.target.value)}
          placeholder="Your name"
          maxLength={32}
        />
      </SetRow>
    </>
  );
}

function DataPanel({
  dbInfo,
}: {
  dbInfo: { path: string; projects: number; threads: number; notes: number };
}) {
  const copyPath = () => {
    try {
      navigator.clipboard.writeText(dbInfo.path);
    } catch (_) {
      // ignore
    }
    pushToast({ kind: "success", message: "Database path copied" });
  };
  return (
    <>
      <SetRow
        label="Database"
        hint="Local-first — everything is stored on this machine"
        stacked
      >
        <div className="set-dbpath">
          <Icon name="database" size={14} />
          <span className="set-dbpath-val mono">{dbInfo.path}</span>
          <button
            className="set-copy"
            onClick={copyPath}
            title="Copy path"
            aria-label="Copy path"
          >
            <Icon name="copy" size={13} />
          </button>
        </div>
      </SetRow>
      <div className="set-dbstats">
        <div className="set-dbstat">
          <span className="set-dbstat-n">{dbInfo.projects}</span>
          <span className="set-dbstat-l">projects</span>
        </div>
        <div className="set-dbstat">
          <span className="set-dbstat-n">{dbInfo.threads}</span>
          <span className="set-dbstat-l">threads</span>
        </div>
        <div className="set-dbstat">
          <span className="set-dbstat-n">{dbInfo.notes}</span>
          <span className="set-dbstat-l">notes</span>
        </div>
      </div>
    </>
  );
}

function DeveloperPanel({
  settings,
  onChange,
}: {
  settings: AppSettings;
  onChange: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
}) {
  return (
    <>
      <p className="set-panel-note">
        These controls only affect this preview build — they let you exercise
        loading, error, and failure states without a backend.
      </p>
      <SetRow label="Force data state" hint="Preview loading & error screens">
        <SetSeg
          value={settings.devState || "auto"}
          onChange={(v) => onChange("devState", v as AppSettings["devState"])}
          options={[
            { value: "auto", label: "Auto" },
            { value: "loading", label: "Loading" },
            { value: "error", label: "Error" },
          ]}
        />
      </SetRow>
      <SetRow
        label="Simulate action failures"
        hint="Make move, append, and create fail, to preview error toasts"
      >
        <button
          className={"set-toggle" + (settings.devFail ? " is-on" : "")}
          role="switch"
          aria-checked={!!settings.devFail}
          onClick={() => onChange("devFail", !settings.devFail)}
        >
          <span className="set-toggle-knob" />
        </button>
      </SetRow>
    </>
  );
}

export function SettingsModal({
  settings,
  onChange,
  onClose,
  dbInfo,
}: {
  settings: AppSettings;
  onChange: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
  onClose: () => void;
  dbInfo: { path: string; projects: number; threads: number; notes: number };
}) {
  const [section, setSection] = useState<SettingsSection>("appearance");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const active = SETTINGS_NAV.find((s) => s.id === section) ?? SETTINGS_NAV[0];

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div
        className="settings"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <nav className="settings-nav">
          <div className="settings-nav-title">Settings</div>
          {SETTINGS_NAV.map((s) => (
            <button
              key={s.id}
              className={"settings-nav-item" + (section === s.id ? " is-active" : "")}
              onClick={() => setSection(s.id)}
            >
              <Icon name={s.icon} size={16} />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="settings-main">
          <div className="settings-head">
            <h2 className="settings-title">{active.label}</h2>
            <button className="dp-icon" onClick={onClose} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="settings-body">
            {section === "appearance" && (
              <AppearancePanel settings={settings} onChange={onChange} />
            )}
            {section === "account" && (
              <AccountPanel settings={settings} onChange={onChange} />
            )}
            {section === "data" && <DataPanel dbInfo={dbInfo} />}
            {section === "developer" && (
              <DeveloperPanel settings={settings} onChange={onChange} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
