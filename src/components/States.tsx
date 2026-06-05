/* Anchor — data-state primitives: empty states, inline load error, and loading
   skeletons. All purely presentational; the backend decides WHEN to show them. */
import { Icon } from "../lib/ui";
import { COLUMNS } from "../lib/meta";

/* Friendly empty state — icon, one line of copy, optional single action. */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  actionIcon,
  onAction,
  compact,
}: {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={"empty" + (compact ? " is-compact" : "")}>
      <span className="empty-ic">
        <Icon name={icon || "inbox"} size={compact ? 18 : 22} />
      </span>
      <div className="empty-title">{title}</div>
      {message && <p className="empty-msg">{message}</p>}
      {actionLabel && onAction && (
        <button className="primary-btn is-sm empty-action" onClick={onAction}>
          <Icon name={actionIcon || "plus"} size={15} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/* Inline data-load failure — shown in place of the view, with a retry. */
export function InlineError({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="loaderr">
      <span className="loaderr-ic">
        <Icon name="unplug" size={22} />
      </span>
      <div className="empty-title">{title || "Couldn’t load this"}</div>
      <p className="empty-msg">
        {message ||
          "Something went wrong reading from disk. Your data is safe."}
      </p>
      {onRetry && (
        <button className="ghost-btn" onClick={onRetry}>
          <Icon name="rotate-ccw" size={14} />
          Try again
        </button>
      )}
    </div>
  );
}

/* ---- Skeletons ---- */
function Skl({ w, h, r }: { w: string; h?: number; r?: number }) {
  return (
    <span
      className="skl"
      style={{ width: w, height: h ?? 12, borderRadius: r != null ? r : 6 }}
    />
  );
}

function SkeletonCard() {
  return (
    <div className="card skl-card">
      <div className="card-top">
        <Skl w="18px" h={18} r={6} />
        <Skl w="54px" />
        <span style={{ flex: 1 }} />
        <Skl w="22px" h={10} />
      </div>
      <Skl w="92%" h={13} />
      <Skl w="60%" h={13} />
    </div>
  );
}

export function SkeletonBoard({
  columns,
}: {
  columns?: typeof COLUMNS;
}) {
  const cols = columns ?? COLUMNS;
  const counts = [3, 2, 2, 1, 2];
  return (
    <div className="board" aria-busy="true">
      <div className="board-cols">
        {cols.map((c, ci) => (
          <div className="col" key={c.id}>
            <div className="col-head">
              <Skl w="9px" h={9} r={99} />
              <Skl w="64px" />
              <span style={{ flex: 1 }} />
              <Skl w="16px" h={10} />
            </div>
            <div className="col-body">
              {Array.from({ length: counts[ci % counts.length] }).map(
                (_, i) => (
                  <SkeletonCard key={i} />
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonList() {
  return (
    <div className="board" aria-busy="true">
      <div className="list">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="row skl-row" key={i}>
            <Skl w="18px" h={18} r={6} />
            <Skl w="56px" />
            <Skl w={`${30 + (i % 4) * 12}%`} h={13} />
            <span style={{ flex: 1 }} />
            <Skl w="18px" h={12} />
            <Skl w="96px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonOverview() {
  return (
    <div className="ov-scroll" aria-busy="true">
      <div className="ov">
        <div className="ov-head">
          <Skl w="52px" h={46} r={12} />
          <div className="ov-head-main" style={{ gap: 8 }}>
            <Skl w="180px" h={22} />
            <Skl w="70px" h={11} />
          </div>
        </div>
        <div
          style={{
            margin: "14px 0 22px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Skl w="100%" h={13} />
          <Skl w="80%" h={13} />
        </div>
        <div className="ov-stats">
          {Array.from({ length: 5 }).map((_, i) => (
            <div className="ov-stat" key={i} style={{ gap: 8 }}>
              <Skl w="40px" h={20} />
              <Skl w="48px" h={11} />
            </div>
          ))}
        </div>
        <div className="dp-sec-head">
          <Skl w="80px" h={14} />
          <span className="line" />
        </div>
        <div className="list ov-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="row skl-row" key={i}>
              <Skl w="18px" h={18} r={6} />
              <Skl w="56px" />
              <Skl w={`${36 + (i % 3) * 10}%`} h={13} />
              <span style={{ flex: 1 }} />
              <Skl w="96px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="dp-body" aria-busy="true">
      <Skl w="70%" h={22} />
      <div style={{ display: "flex", gap: 10, margin: "14px 0 18px" }}>
        <Skl w="90px" h={20} r={8} />
        <Skl w="110px" h={20} r={8} />
      </div>
      <Skl w="100%" h={13} />
      <div style={{ height: 6 }} />
      <Skl w="88%" h={13} />
      <div className="dp-sec-head" style={{ marginTop: 28 }}>
        <Skl w="80px" h={14} />
        <span className="line" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div className="skl-note" key={i}>
          <Skl w="22px" h={22} r={99} />
          <div
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: 7 }}
          >
            <Skl w="40%" h={11} />
            <Skl w="92%" h={12} />
            <Skl w="64%" h={12} />
          </div>
        </div>
      ))}
    </div>
  );
}
