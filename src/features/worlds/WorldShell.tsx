import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { commands } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import type { TabId } from '../../state/store';
import { TopDock } from '../../components/common/TopDock';
import { PeekPanel } from '../../components/common/PeekPanel';
import { useInlineLinkClicks } from '../../components/linking/useInlineLinkClicks';
import { useBrokenLinkResolver } from '../../components/linking/useBrokenLinkResolver';
import { BrokenLinkRepairMenu } from '../../components/linking/BrokenLinkRepairMenu';
import { InlineLinkHoverCard } from '../../components/linking/InlineLinkHoverCard';
import { clearImageCache } from '../../hooks/useImageCache';
import { WorldOverview } from './WorldOverview';
import { AtlasUnderConstruction } from '../atlas/AtlasUnderConstruction';
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
        // setActiveWorld consumes a fresh pendingResume internally (see
        // store.ts) — no separate application step, so StrictMode's double
        // open can't clobber the staged destination.
        setActiveWorld(detail);
      } catch (e) {
        setError(String(e));
      }
    })();

    return () => {
      commands.closeWorld().catch(console.error);
      setActiveWorld(null);
      // (pendingResume is deliberately NOT cleared here: StrictMode runs this
      // cleanup between its double mount, which would wipe a staged resume
      // before it ever applied. The worldId scoping above prevents leaks.)
      // Revoke every Blob URL held by the image cache — the next world
      // opens into a fresh cache instead of inheriting stale blobs.
      clearImageCache();
    };
  }, [worldId]);

  // Snapshot the current position (tab + selected entity) to the registry,
  // debounced, so the world index can offer "Resume where you left off".
  // Written on change rather than on unmount — survives hard app quits.
  const selectedCharacterId = useAppStore((s) => s.selectedCharacterId);
  const selectedDocumentId = useAppStore((s) => s.selectedDocumentId);
  useEffect(() => {
    if (!worldId || !activeWorld) return;
    const t = window.setTimeout(() => {
      const entityType = selectedCharacterId
        ? ('character' as const)
        : selectedDocumentId
          ? ('lore_document' as const)
          : null;
      commands
        .updateLastPosition({
          worldId,
          tab: activeTab,
          entityType,
          entityId: selectedCharacterId ?? selectedDocumentId ?? null,
        })
        .catch(console.error);
    }, 800);
    return () => window.clearTimeout(t);
  }, [worldId, activeWorld, activeTab, selectedCharacterId, selectedDocumentId]);

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
            {/* Atlas Canvas is detached for redesign — placeholder only. */}
            <AtlasUnderConstruction />
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
      <BrokenLinkRepairMenu />
      <InlineLinkHoverCard />
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
