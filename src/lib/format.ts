// Pure display formatters — no side effects, no imports.

/** Last path segment, e.g. "~/Dev/Projects/anchor" → "anchor". */
export function basename(p: string): string {
  return (p || "").replace(/\/+$/, "").split("/").pop() ?? "";
}

/** Collapse long path for compact display: show just the folder name. */
export function pathLabel(p: string): string {
  return basename(p);
}

/**
 * "github.com/Shridhar600/Anchor" → "Shridhar600/Anchor"
 * Strips protocol prefix and the hostname, leaving owner/repo.
 */
export function repoLabel(remote: string): string {
  if (!remote) return "";
  let s = remote.replace(/^https?:\/\//, "").replace(/\.git$/, "");
  const parts = s.split("/");
  // drop host like github.com (contains a dot)
  if (parts[0] && parts[0].includes(".")) parts.shift();
  return parts.join("/");
}
