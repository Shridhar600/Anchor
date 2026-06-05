/* Onboarding — empty state for a brand-new workspace (no projects yet). */
import { Icon } from "../lib/ui";
import anchorMark from "../assets/anchor-mark.png";

export function Onboarding({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <div className="onb">
      <div className="onb-inner">
        <img
          className="onb-logo"
          src={anchorMark}
          alt="Anchor"
          style={{ width: 76, height: 76, marginBottom: 4 }}
        />
        <h1 className="onb-title">No projects yet</h1>
        <p className="onb-sub">
          Create your first project to start tracking threads, decisions, and
          where you left off.
        </p>
        <div className="onb-actions">
          <button className="primary-btn" onClick={onCreate}>
            <Icon name="plus" size={15} />
            Create project
          </button>
          <button className="ghost-btn onb-import" onClick={onImport}>
            <Icon name="download" size={15} />
            Import from repo
          </button>
        </div>
        <a
          className="onb-learn"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          Learn more <Icon name="arrow-up-right" size={13} />
        </a>
      </div>
    </div>
  );
}
