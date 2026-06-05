// WindowControls — renders nothing on macOS (native traffic lights handle it).
// On Windows/Linux (frameless window) renders min/maximize/close buttons at far-right.

import { getCurrentWindow } from "@tauri-apps/api/window";
import { Icon } from "../lib/ui";
import { platform } from "../lib/platform";

function minimize() {
  getCurrentWindow().minimize().catch(() => {});
}
function toggleMaximize() {
  getCurrentWindow().toggleMaximize().catch(() => {});
}
function closeWindow() {
  getCurrentWindow().close().catch(() => {});
}

export function WindowControls() {
  if (platform === "macos") return null;

  return (
    <div className="winctrls">
      <button
        className="winctrl"
        onClick={minimize}
        title="Minimize"
        aria-label="Minimize window"
      >
        <Icon name="minus" size={14} />
      </button>
      <button
        className="winctrl"
        onClick={toggleMaximize}
        title="Maximize / Restore"
        aria-label="Maximize or restore window"
      >
        <Icon name="square" size={13} />
      </button>
      <button
        className="winctrl winctrl-close"
        onClick={closeWindow}
        title="Close"
        aria-label="Close window"
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}
