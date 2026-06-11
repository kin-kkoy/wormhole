import { useState } from 'react';
import type { WorldDetail, WorldOverviewData } from '../../lib/commands';
import './WorldSummaryCard.css';

interface WorldSummaryCardProps {
  world: WorldDetail;
  stats: WorldOverviewData | null;
}

export function WorldSummaryCard({ world, stats }: WorldSummaryCardProps) {
  const [open, setOpen] = useState(false);

  const created = (() => {
    try {
      const d = new Date(world.created_at);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  })();

  return (
    <>
      <button
        className={`wsc-toggle ${open ? 'wsc-toggle--active' : ''}`}
        onClick={() => setOpen(!open)}
        title={open ? 'Hide world info' : 'Show world info'}
        aria-expanded={open}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
          <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>

      {open && (
        <div className="wsc" role="complementary" aria-label="World summary">
          {world.world_type && (
            <span className="wsc__type">{world.world_type}</span>
          )}
          <h2 className="wsc__title">{world.title}</h2>
          {world.summary && (
            <p className="wsc__summary">{world.summary}</p>
          )}
          <div className="wsc__rule" />
          <div className="wsc__meta">
            {stats && (
              <>
                <div className="wsc__meta-item">
                  <span className="wsc__meta-value wsc__meta-value--chars">{stats.characters.count}</span>
                  <span className="wsc__meta-label">Characters</span>
                </div>
                <div className="wsc__meta-item">
                  <span className="wsc__meta-value wsc__meta-value--lore">{stats.lore.count}</span>
                  <span className="wsc__meta-label">Documents</span>
                </div>
              </>
            )}
            {created && (
              <div className="wsc__meta-item">
                <span className="wsc__meta-value wsc__meta-value--date">{created}</span>
                <span className="wsc__meta-label">Created</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
