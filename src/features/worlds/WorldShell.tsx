import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { commands } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import type { TabId } from '../../state/store';
import { TopDock } from '../../components/common/TopDock';
import { PeekPanel } from '../../components/common/PeekPanel';
import { useInlineLinkClicks } from '../../components/linking/useInlineLinkClicks';
import { useBrokenLinkResolver } from '../../components/linking/useBrokenLinkResolver';
import { clearImageCache } from '../../hooks/useImageCache';
import { WorldOverview } from './WorldOverview';
import { AtlasCanvas } from '../atlas/AtlasCanvas';
import { CharacterCodex } from '../characters/CharacterCodex';
import { LoreArchive } from '../lore/LoreArchive';
import { ROUTES } from '../../app/routes';
import './WorldShell.css';

export function WorldShell() {
  const { worldId } = useParams<{ worldId: string }>();
  const navigate = useNavigate();
  const activeWorld = useAppStore((s) => s.activeWorld);
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveWorld = useAppStore((s) => s.setActiveWorld);
  const peekReturn = useAppStore((s) => s.peekReturn);
  const restoreFromPeekReturn = useAppStore((s) => s.restoreFromPeekReturn);
  const [error, setError] = useState<string | null>(null);

  useInlineLinkClicks();
  useBrokenLinkResolver();

  // Track which tabs the user has visited. Once visited, we keep the tab's
  // component mounted and just hide it with CSS — avoiding the remount cost
  // (canvas backing-store reallocation, d3-zoom teardown/attach, reloading
  // entities, etc.) when they switch back.
  const [visitedTabs, setVisitedTabs] = useState<Set<TabId>>(
    () => new Set<TabId>(['overview']),
  );
  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    if (!worldId) return;

    (async () => {
      try {
        const detail = await commands.openWorld(worldId);
        setActiveWorld(detail);
      } catch (e) {
        setError(String(e));
      }
    })();

    return () => {
      commands.closeWorld().catch(console.error);
      setActiveWorld(null);
      // Revoke every Blob URL held by the image cache — the next world
      // opens into a fresh cache instead of inheriting stale blobs.
      clearImageCache();
    };
  }, [worldId]);

  function handleBack() {
    navigate(ROUTES.worldIndex);
  }

  if (error) {
    return (
      <div className="world-shell__error">
        <p>Failed to open world: {error}</p>
        <button className="btn btn--primary" onClick={handleBack}>
          Back to World Index
        </button>
      </div>
    );
  }

  if (!activeWorld) {
    return (
      <div className="world-shell__loading">Loading world...</div>
    );
  }

  return (
    <div className="world-shell">
      <TopDock onBack={handleBack} />
      {peekReturn && (
        <button
          type="button"
          className="world-shell__peek-back"
          onClick={restoreFromPeekReturn}
          title="Return to peek"
        >
          ← Back
        </button>
      )}
      <main className="world-shell__content">
        {visitedTabs.has('overview') && (
          <TabPane active={activeTab === 'overview'}>
            <WorldOverview />
          </TabPane>
        )}
        {visitedTabs.has('atlas') && (
          <TabPane active={activeTab === 'atlas'}>
            <AtlasCanvas />
          </TabPane>
        )}
        {visitedTabs.has('characters') && (
          <TabPane active={activeTab === 'characters'}>
            <CharacterCodex />
          </TabPane>
        )}
        {visitedTabs.has('lore') && (
          <TabPane active={activeTab === 'lore'}>
            <LoreArchive />
          </TabPane>
        )}
      </main>
      <PeekPanel />
    </div>
  );
}

/**
 * Renders its children full-size, hiding them with display:none when inactive.
 * Using display:none (vs conditional mount) preserves component state — zoom
 * position, paint strokes, scroll position, selection — across tab switches.
 */
function TabPane({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: active ? 'block' : 'none',
        width: '100%',
        height: '100%',
      }}
    >
      {children}
    </div>
  );
}
