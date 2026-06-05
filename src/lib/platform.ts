// Zero-dependency platform detection using navigator APIs.
// Returns "macos" | "windows" | "linux" — resolved once at module load.

export type Platform = "macos" | "windows" | "linux";

export function detectPlatform(): Platform {
  // navigator.userAgentData is available in modern Chromium-based runtimes (Tauri's WebView).
  // Fall back to userAgent / platform string matching for wider compat.
  const ua = navigator.userAgent;
  const platform =
    (navigator as { userAgentData?: { platform?: string } }).userAgentData
      ?.platform ?? navigator.platform ?? "";

  const p = platform.toLowerCase();
  const u = ua.toLowerCase();

  if (p.startsWith("mac") || u.includes("mac os x") || u.includes("macos")) {
    return "macos";
  }
  if (p.startsWith("win") || u.includes("windows")) {
    return "windows";
  }
  return "linux";
}

/** The resolved platform for this session. Computed once. */
export const platform: Platform = detectPlatform();
