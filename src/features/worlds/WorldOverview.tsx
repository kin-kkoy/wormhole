import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { OverviewTabSelector } from '../../components/worlds/OverviewTabSelector';
import { SearchOverlay } from '../../components/worlds/graph/SearchOverlay';
import { CharactersGraph } from '../../components/worlds/graph/CharactersGraph';
import { LoreGraph } from '../../components/worlds/graph/LoreGraph';
import { AtlasUnderConstruction } from '../atlas/AtlasUnderConstruction';
import './WorldOverview.css';

export function WorldOverview() {
  const world = useAppStore((s) => s.activeWorld);
  const overviewTab = useAppStore((s) => s.overviewTab);
  const loadOverviewTab = useAppStore((s) => s.loadOverviewTab);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOverviewTab();
  }, []);

  // Reset search when switching tabs
  useEffect(() => {
    setSearchQuery('');
  }, [overviewTab]);

  if (!world) {
    return (
      <div className="world-overview world-overview--loading">
        <span className="world-overview__loading-text">Loading...</span>
      </div>
    );
  }

  const searchPlaceholder =
    overviewTab === 'characters' ? 'Search characters...' : 'Search lore...';

  return (
    <div className="world-overview">
      <div className="world-overview__toolbar">
        <OverviewTabSelector />
        {overviewTab !== 'atlas' && (
          <SearchOverlay
            query={searchQuery}
            onQueryChange={setSearchQuery}
            placeholder={searchPlaceholder}
          />
        )}
      </div>

      <div className="world-overview__content">
        {overviewTab === 'atlas' && (
          // Atlas Canvas is detached for redesign — placeholder only.
          <AtlasUnderConstruction compact />
        )}
        {overviewTab === 'characters' && (
          <CharactersGraph searchQuery={searchQuery} />
        )}
        {overviewTab === 'lore' && (
          <LoreGraph searchQuery={searchQuery} />
        )}
      </div>
    </div>
  );
}
