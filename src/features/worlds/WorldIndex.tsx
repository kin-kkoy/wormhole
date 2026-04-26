import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { commands, type WorldSummary } from '../../lib/commands';
import { ROUTES } from '../../app/routes';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { WorldFormDialog } from '../../components/worlds/WorldFormDialog';
import './WorldIndex.css';

type SetupState = 'loading' | 'needs-setup' | 'ready';

export function WorldIndex() {
  const navigate = useNavigate();
  const [setupState, setSetupState] = useState<SetupState>('loading');
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWorld, setEditingWorld] = useState<WorldSummary | null>(null);
  const [deletingWorld, setDeletingWorld] = useState<WorldSummary | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const config = await commands.getAppConfig();
        if (config.storage_folder) {
          setSetupState('ready');
          loadWorlds();
        } else {
          setSetupState('needs-setup');
        }
      } catch (e) {
        console.error('Failed to load config:', e);
        setSetupState('needs-setup');
      }
    })();
  }, []);

  async function loadWorlds() {
    try {
      const list = await commands.listWorlds();
      setWorlds(list);
    } catch (e) {
      console.error('Failed to load worlds:', e);
    }
  }

  async function handlePickFolder() {
    try {
      const selected = await open({ directory: true, title: 'Choose Wormhole storage folder' });
      if (selected) {
        await commands.setStorageFolder(selected as string);
        setSetupState('ready');
        loadWorlds();
      }
    } catch (e) {
      console.error('Failed to pick folder:', e);
    }
  }

  async function handleUseDefault() {
    try {
      const config = await commands.getAppConfig();
      const defaultPath = (config.storage_folder || '');
      if (!defaultPath) {
        await commands.setStorageFolder('__default__');
      }
      setSetupState('ready');
      loadWorlds();
    } catch (e) {
      console.error('Failed to set default folder:', e);
    }
  }

  async function handleCreateWorld(values: {
    title: string;
    worldType: string;
    summary: string;
    coverFilePath: string | null;
    coverRemoved: boolean;
  }) {
    try {
      const newWorld = await commands.createWorld(
        values.title,
        values.worldType,
        values.summary || undefined
      );

      if (values.coverFilePath) {
        await commands.openWorld(newWorld.id);
        const assetId = await commands.importAsset(values.coverFilePath);
        await commands.updateWorld({ coverAssetId: assetId });
        await commands.closeWorld();
      }

      setShowCreateDialog(false);
      loadWorlds();
    } catch (e) {
      console.error('Failed to create world:', e);
    }
  }

  async function handleEditWorld(values: {
    title: string;
    worldType: string;
    summary: string;
    coverFilePath: string | null;
    coverRemoved: boolean;
  }) {
    if (!editingWorld) return;
    try {
      await commands.openWorld(editingWorld.id);

      let coverAssetId: string | undefined;
      if (values.coverFilePath) {
        coverAssetId = await commands.importAsset(values.coverFilePath);
      } else if (values.coverRemoved) {
        coverAssetId = ''; // Signal backend to clear cover
      }

      await commands.updateWorld({
        title: values.title,
        summary: values.summary,
        worldType: values.worldType,
        coverAssetId,
      });

      await commands.closeWorld();
      setEditingWorld(null);
      loadWorlds();
    } catch (e) {
      console.error('Failed to edit world:', e);
      // Try to close world if it was opened
      commands.closeWorld().catch(() => {});
    }
  }

  async function handleDeleteWorld() {
    if (!deletingWorld) return;
    try {
      await commands.deleteWorld(deletingWorld.id);
      setDeletingWorld(null);
      loadWorlds();
    } catch (err) {
      console.error('Failed to delete world:', err);
    }
  }

  async function handleSeedWorld() {
    try {
      await commands.seedExampleWorld();
      loadWorlds();
    } catch (e) {
      console.error('Failed to seed world:', e);
    }
  }

  function openWorld(worldId: string) {
    navigate(ROUTES.world(worldId));
  }

  const filteredWorlds = searchQuery
    ? worlds.filter((w) =>
        w.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : worlds;

  if (setupState === 'loading') {
    return (
      <div className="world-index">
        <div className="world-index__loading">Loading...</div>
      </div>
    );
  }

  if (setupState === 'needs-setup') {
    return (
      <div className="world-index">
        <div className="world-index__setup">
          <h1 className="world-index__setup-title">Welcome to Wormhole</h1>
          <p className="world-index__setup-subtitle">
            Choose where to store your world files.
          </p>
          <div className="world-index__setup-actions">
            <button className="btn btn--primary" onClick={handlePickFolder}>
              Pick a Folder
            </button>
            <button className="btn btn--secondary" onClick={handleUseDefault}>
              Use Default Location
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="world-index">
      <header className="world-index__header">
        <h1 className="world-index__heading">Wormhole</h1>
        <div className="world-index__header-actions">
          {import.meta.env.DEV && (
            <button className="btn btn--ghost" onClick={handleSeedWorld}>
              Seed Example
            </button>
          )}
          <button className="btn btn--primary" onClick={() => setShowCreateDialog(true)}>
            Create World
          </button>
        </div>
      </header>

      {worlds.length > 0 && (
        <div className="world-index__search">
          <svg className="world-index__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="world-index__search-input"
            type="text"
            placeholder="Search worlds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {worlds.length === 0 ? (
        <div className="world-index__empty">
          <div className="world-index__empty-icon">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="24" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
              <circle cx="32" cy="32" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
              <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.15"/>
              <circle cx="32" cy="32" r="3" fill="currentColor" opacity="0.3"/>
            </svg>
          </div>
          <h2 className="world-index__empty-title">No worlds yet</h2>
          <p className="world-index__empty-subtitle">
            Create your first world to start building.
          </p>
          <button
            className="btn btn--primary"
            onClick={() => setShowCreateDialog(true)}
          >
            Create Your First World
          </button>
        </div>
      ) : (
        <div className="world-index__grid">
          {filteredWorlds.map((world) => (
            <div
              key={world.id}
              className="world-card"
              role="button"
              tabIndex={0}
              onClick={() => openWorld(world.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openWorld(world.id);
                }
              }}
            >
              <div className="world-card__cover">
                {world.cover_thumbnail_base64 ? (
                  <img
                    className="world-card__cover-img"
                    src={`data:image/png;base64,${world.cover_thumbnail_base64}`}
                    alt=""
                  />
                ) : null}
              </div>
              <div className="world-card__info">
                <div className="world-card__top-row">
                  <span className="world-card__title">{world.title}</span>
                  <span className="world-card__badge">{world.world_type}</span>
                </div>
                {world.summary && (
                  <p className="world-card__summary">{world.summary}</p>
                )}
                {world.last_opened && (
                  <span className="world-card__meta">
                    Last opened {new Date(world.last_opened).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="world-card__actions">
                <button
                  className="world-card__action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingWorld(world);
                  }}
                  title="Edit world"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  className="world-card__action-btn world-card__action-btn--danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingWorld(world);
                  }}
                  title="Delete world"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M11 3L3 11M3 3L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <WorldFormDialog
          mode="create"
          onSubmit={handleCreateWorld}
          onCancel={() => setShowCreateDialog(false)}
        />
      )}

      {editingWorld && (
        <WorldFormDialog
          mode="edit"
          initialValues={{
            title: editingWorld.title,
            worldType: editingWorld.world_type,
            summary: editingWorld.summary ?? '',
            coverPreviewUrl: editingWorld.cover_thumbnail_base64
              ? `data:image/png;base64,${editingWorld.cover_thumbnail_base64}`
              : null,
          }}
          onSubmit={handleEditWorld}
          onCancel={() => setEditingWorld(null)}
        />
      )}

      {deletingWorld && (
        <ConfirmDialog
          title="Delete World"
          message={`Are you sure you want to permanently delete "${deletingWorld.title}"? This will remove the .wormhole file and cannot be undone.`}
          confirmLabel="Delete"
          confirmDanger
          onConfirm={handleDeleteWorld}
          onCancel={() => setDeletingWorld(null)}
        />
      )}
    </div>
  );
}
