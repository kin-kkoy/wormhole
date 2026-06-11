import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/plugin-dialog';
import { commands, type WorldSummary, type LastPosition } from '../../lib/commands';
import { ROUTES } from '../../app/routes';
import { useAppStore, type TabId } from '../../state/store';
import { useTheme } from '../../app/providers';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ContextMenu } from '../../components/common/ContextMenu';
import { WorldFormDialog } from '../../components/worlds/WorldFormDialog';
import './WorldIndex.css';

type SetupState = 'loading' | 'needs-setup' | 'ready';

const VALID_TABS: TabId[] = ['overview', 'atlas', 'characters', 'lore'];

/** Parse a world's last_position snapshot; only positions that point at a
 *  real entity earn a resume pill (a bare tab isn't worth one — the card
 *  already opens to Overview). */
function parseResumable(json: string | null): LastPosition | null {
  if (!json) return null;
  try {
    const pos = JSON.parse(json) as LastPosition;
    if (!pos.entity_id || !pos.entity_title || !pos.entity_type) return null;
    if (!VALID_TABS.includes(pos.tab as TabId)) return null;
    return pos;
  } catch {
    return null;
  }
}

export function WorldIndex() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [setupState, setSetupState] = useState<SetupState>('loading');
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWorld, setEditingWorld] = useState<WorldSummary | null>(null);
  const [deletingWorld, setDeletingWorld] = useState<WorldSummary | null>(null);

  // Kebab menu state
  const [menuWorld, setMenuWorld] = useState<{ world: WorldSummary; x: number; y: number } | null>(null);

  // Ripple transition state
  const [ripple, setRipple] = useState<{ x: number; y: number; worldId: string } | null>(null);

  // Safety net: navigation is normally triggered by the ripple's
  // animationend, but WebKitGTK is documented (CLAUDE.md §gotchas) to stall
  // CSS animations on non-composited surfaces — without this fallback a
  // stalled ripple would leave the user stuck on the index forever.
  useEffect(() => {
    if (!ripple) return;
    const t = window.setTimeout(() => navigate(ROUTES.world(ripple.worldId)), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ripple]);

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

  function resumeWorld(worldId: string, pos: LastPosition) {
    // Stage the destination for WorldShell to apply AFTER the world opens —
    // setActiveWorld resets tab/selection state on open, so writing the tab
    // and selection here directly would be wiped before the user saw them.
    useAppStore.getState().setPendingResume({
      worldId,
      tab: pos.tab as TabId,
      entityType: pos.entity_type,
      entityId: pos.entity_id,
      stagedAt: Date.now(),
    });
    navigate(ROUTES.world(worldId));
  }

  function openWorld(worldId: string, e: React.MouseEvent) {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      navigate(ROUTES.world(worldId));
      return;
    }
    const sphere = (e.currentTarget as HTMLElement).querySelector('.world-card__sphere');
    if (sphere) {
      const rect = sphere.getBoundingClientRect();
      setRipple({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, worldId });
    } else {
      navigate(ROUTES.world(worldId));
    }
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
          <button
            className="world-index__theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M9 2V3.5M9 14.5V16M16 9H14.5M3.5 9H2M13.95 4.05L12.89 5.11M5.11 12.89L4.05 13.95M13.95 13.95L12.89 12.89M5.11 5.11L4.05 4.05" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M15.5 10.4a6.5 6.5 0 01-7.9-7.9A6.5 6.5 0 1015.5 10.4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
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
              onClick={(e) => openWorld(world.id, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openWorld(world.id, e as unknown as React.MouseEvent);
                }
              }}
            >
              <div className="world-card__sphere">
                <div className="world-card__ring" />
                <div className="world-card__core" />
                {world.cover_thumbnail_base64 ? (
                  <div className="world-card__cover">
                    <img
                      className="world-card__cover-img"
                      src={`data:image/png;base64,${world.cover_thumbnail_base64}`}
                      alt=""
                    />
                  </div>
                ) : (
                  <div className="world-card__glyph">
                    {world.title.charAt(0).toUpperCase()}
                  </div>
                )}
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
                {(() => {
                  const pos = parseResumable(world.last_position);
                  if (!pos) return null;
                  return (
                    <button
                      type="button"
                      className="world-card__resume"
                      onClick={(e) => {
                        e.stopPropagation();
                        resumeWorld(world.id, pos);
                      }}
                      title={`Jump back to “${pos.entity_title}”`}
                    >
                      <span className="world-card__resume-icon" aria-hidden="true">⤷</span>
                      <span
                        className="world-card__resume-dot"
                        data-type={pos.entity_type}
                        aria-hidden="true"
                      />
                      <span className="world-card__resume-text">
                        Resume “{pos.entity_title}”
                      </span>
                    </button>
                  );
                })()}
              </div>
              <button
                className="world-card__kebab"
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuWorld({ world, x: rect.right + 4, y: rect.top });
                }}
                title="World options"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                  <circle cx="7" cy="3" r="1.2"/>
                  <circle cx="7" cy="7" r="1.2"/>
                  <circle cx="7" cy="11" r="1.2"/>
                </svg>
              </button>
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

      {menuWorld && (
        <ContextMenu
          x={menuWorld.x}
          y={menuWorld.y}
          items={[
            { label: 'Edit', onClick: () => setEditingWorld(menuWorld.world) },
            { label: 'Delete', onClick: () => setDeletingWorld(menuWorld.world), danger: true },
          ]}
          onClose={() => setMenuWorld(null)}
        />
      )}

      {ripple && (
        <div
          className="world-index__ripple"
          style={{
            '--ripple-x': `${ripple.x}px`,
            '--ripple-y': `${ripple.y}px`,
          } as React.CSSProperties}
          onAnimationEnd={() => navigate(ROUTES.world(ripple.worldId))}
        />
      )}
    </div>
  );
}
