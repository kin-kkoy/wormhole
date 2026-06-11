import { useEffect, useState } from 'react';
import { commands, type WorldOverviewData } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { SearchOverlay } from '../../components/worlds/graph/SearchOverlay';
import { UnifiedGraph } from '../../components/worlds/graph/UnifiedGraph';
import { StarParticles } from '../../components/worlds/StarParticles';
import { WorldSummaryCard } from '../../components/worlds/WorldSummaryCard';
import './WorldOverview.css';

function EditToggle() {
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
  return (
    <button
      className={`world-overview__edit-toggle ${editMode ? 'world-overview__edit-toggle--active' : ''}`}
      onClick={() => setEditMode(!editMode)}
      title={editMode ? 'Exit edit mode' : 'Edit mode'}
    >
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
        <path d="M13.5 2.5l2 2-9 9H4.5v-2l9-9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        {editMode && <path d="M11 5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
      </svg>
    </button>
  );
}

export function WorldOverview() {
  const world = useAppStore((s) => s.activeWorld);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<WorldOverviewData | null>(null);

  useEffect(() => {
    commands.getWorldOverview().then(setStats).catch(console.error);
  }, []);

  if (!world) {
    return (
      <div className="world-overview world-overview--loading">
        <span className="world-overview__loading-text">Loading...</span>
      </div>
    );
  }

  return (
    <div className="world-overview">
      <StarParticles />
      <div className="world-overview__toolbar">
        <SearchOverlay
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search characters & lore..."
        />
        {stats && (
          <div className="world-overview__stats">
            <span className="world-overview__stat" data-accent="characters">
              <span className="world-overview__stat-value">{stats.characters.count}</span>
              <span className="world-overview__stat-label">Characters</span>
            </span>
            <span className="world-overview__stat" data-accent="lore">
              <span className="world-overview__stat-value">{stats.lore.count}</span>
              <span className="world-overview__stat-label">Documents</span>
            </span>
          </div>
        )}
        <EditToggle />
      </div>
      <div className="world-overview__content">
        <WorldSummaryCard world={world} stats={stats} />
        <UnifiedGraph searchQuery={searchQuery} />
      </div>
    </div>
  );
}
