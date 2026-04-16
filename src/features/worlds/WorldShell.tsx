import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { commands } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { TopDock } from '../../components/common/TopDock';
import { WorldOverview } from './WorldOverview';
import { AtlasPlaceholder } from '../atlas/AtlasPlaceholder';
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
  const [error, setError] = useState<string | null>(null);

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

  const tabContent = {
    overview: <WorldOverview />,
    atlas: <AtlasPlaceholder />,
    characters: <CharacterCodex />,
    lore: <LoreArchive />,
  };

  return (
    <div className="world-shell">
      <TopDock worldTitle={activeWorld.title} onBack={handleBack} />
      <main className="world-shell__content">
        {tabContent[activeTab]}
      </main>
    </div>
  );
}
