import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { commands } from '../../lib/commands';
import type { CharacterSummary } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { useImageCache } from '../../hooks/useImageCache';
import { CharacterCreateDialog } from '../../components/characters/CharacterCreateDialog';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CharacterRecycleBin } from './CharacterRecycleBin';
import { CharacterTypographySettings } from './CharacterTypographySettings';
import { useCharacterTypography } from '../../hooks/useCharacterTypography';
import './CharacterList.css';

type SortMode = 'manual' | 'name' | 'recent' | 'created';

const SORT_LABEL: Record<SortMode, string> = {
  manual: 'Manual',
  name: 'Name (A–Z)',
  recent: 'Recently edited',
  created: 'Newest first',
};

export function CharacterList() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CharacterSummary | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  // Set briefly after a drop so the subsequent synthetic click (some WebKit
  // builds fire one after drag/drop) doesn't navigate to the dropped-on card.
  const justDroppedRef = useRef(false);
  // Live-reflow state. dragCurrentIndexRef tracks where the dragged card has
  // moved to as it slides across targets (updated synchronously to survive
  // React's state batching during rapid dragOver events). originalOrderRef
  // snapshots the starting array so dragEnd without a drop can restore.
  const dragCurrentIndexRef = useRef<number | null>(null);
  const originalOrderRef = useRef<CharacterSummary[] | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [showBulkTagInput, setShowBulkTagInput] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [showTypographySettings, setShowTypographySettings] = useState(false);

  const setSelectedCharacterId = useAppStore((s) => s.setSelectedCharacterId);
  const editMode = useAppStore((s) => s.editMode);
  const activeWorld = useAppStore((s) => s.activeWorld);
  const typography = useCharacterTypography(activeWorld?.id ?? null);
  const { getImageUrl, loadImages } = useImageCache();
  const listRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await commands.listCharacters();
      setCharacters(data);
    } catch (e) {
      console.error('Failed to list characters:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const ids = characters
      .map((c) => c.image_asset_id)
      .filter((id): id is string => id != null);
    if (ids.length > 0) loadImages(ids);
  }, [characters, loadImages]);

  // All unique tags across the unfiltered list — so tag chips don't disappear
  // as the user narrows the selection.
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const c of characters) {
      if (c.tags_text) {
        c.tags_text.split(',').forEach((t) => {
          const trimmed = t.trim().toLowerCase();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    }
    return Array.from(tagSet).sort();
  }, [characters]);

  // Filter + sort pipeline.
  const filteredCharacters = useMemo(() => {
    let result = characters;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (activeTags.size > 0) {
      result = result.filter((c) => {
        if (!c.tags_text) return false;
        const tags = c.tags_text.split(',').map((t) => t.trim().toLowerCase());
        // AND semantics: every selected tag must be present.
        for (const t of activeTags) {
          if (!tags.includes(t)) return false;
        }
        return true;
      });
    }
    if (sortMode !== 'manual') {
      result = [...result];
      if (sortMode === 'name') {
        result.sort((a, b) => a.name.localeCompare(b.name));
      } else if (sortMode === 'recent') {
        // Most recently edited first.
        result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      } else if (sortMode === 'created') {
        // Newest first.
        result.sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
    }
    return result;
  }, [characters, searchQuery, activeTags, sortMode]);

  async function handleCreate() {
    setShowCreateDialog(true);
  }

  async function handleCreateComplete(characterId: string) {
    setShowCreateDialog(false);
    await refresh();
    setSelectedCharacterId(characterId);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await commands.deleteCharacter(deleteTarget.id);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      console.error('Failed to delete character:', e);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(ids.map((id) => commands.deleteCharacter(id)));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      await refresh();
    } catch (e) {
      console.error('Bulk delete failed:', e);
    }
  }

  async function handleBulkAddTag() {
    const tag = bulkTagInput.trim().toLowerCase();
    if (!tag) {
      setShowBulkTagInput(false);
      return;
    }
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map((id) => {
          const c = characters.find((x) => x.id === id);
          const current = c?.tags_text ? c.tags_text.split(',').map((t) => t.trim().toLowerCase()) : [];
          if (current.includes(tag)) return Promise.resolve();
          const next = [...current, tag].join(', ');
          return commands.updateCharacter({ characterId: id, tagsText: next });
        }),
      );
      setBulkTagInput('');
      setShowBulkTagInput(false);
      await refresh();
    } catch (e) {
      console.error('Bulk add-tag failed:', e);
    }
  }

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function handleCardClick(e: React.MouseEvent, char: CharacterSummary, index: number) {
    // Suppress the click that some environments fire right after a drop —
    // otherwise dropping onto a card also navigates to it.
    if (justDroppedRef.current) return;
    // Shift or Ctrl/Cmd → selection mode, not navigation.
    if (e.shiftKey && lastSelectedIndex !== null) {
      e.preventDefault();
      const [lo, hi] = lastSelectedIndex < index
        ? [lastSelectedIndex, index]
        : [index, lastSelectedIndex];
      const range = filteredCharacters.slice(lo, hi + 1).map((c) => c.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of range) next.add(id);
        return next;
      });
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(char.id)) next.delete(char.id);
        else next.add(char.id);
        return next;
      });
      setLastSelectedIndex(index);
      return;
    }
    // Plain click → clear any selection and navigate.
    if (selectedIds.size > 0) setSelectedIds(new Set());
    setSelectedCharacterId(char.id);
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    // WebKitGTK (Tauri's Linux webview) will not fire `drop` unless the drag
    // carries a dataTransfer payload. Without this, cards snap back on release.
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    // Snapshot the pre-drag order — restored on cancel, discarded on drop.
    originalOrderRef.current = characters;
    dragCurrentIndexRef.current = index;
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Reordering only valid on the unfiltered, manually-sorted full list.
    if (searchQuery || activeTags.size > 0 || sortMode !== 'manual') return;

    const from = dragCurrentIndexRef.current;
    if (from === null || from === targetIndex) return;

    // Live reflow: splice the dragged card into its new position so the
    // grid physically rearranges under the cursor. Persistence is deferred
    // to onDrop — this is a local, optimistic shuffle.
    setCharacters((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    dragCurrentIndexRef.current = targetIndex;
    setDragIndex(targetIndex);
  }

  async function handleDrop(e: React.DragEvent, _dropIndex: number) {
    e.preventDefault();
    e.stopPropagation();
    justDroppedRef.current = true;
    // Clear the flag after the current event loop so a stray click is
    // suppressed but normal subsequent clicks work.
    setTimeout(() => { justDroppedRef.current = false; }, 0);

    const dragged = dragCurrentIndexRef.current;
    const starting = originalOrderRef.current;
    // Successful drop — discard the snapshot and commit whatever the live
    // splices produced. If the array never moved, skip the round-trip.
    originalOrderRef.current = null;
    dragCurrentIndexRef.current = null;
    setDragIndex(null);

    if (dragged === null || !starting) return;
    const unchanged = starting.length === characters.length &&
      starting.every((c, i) => c.id === characters[i].id);
    if (unchanged) return;

    try {
      await commands.reorderCharacters(characters.map((c) => c.id));
    } catch (err) {
      console.error('Failed to reorder:', err);
      await refresh();
    }
  }

  function handleDragEnd() {
    // dragEnd fires after dragEnter/dragLeave/drop. If we didn't drop (e.g.
    // user released outside the grid or pressed Escape), originalOrderRef
    // still holds the pre-drag snapshot — restore it.
    if (originalOrderRef.current) {
      setCharacters(originalOrderRef.current);
      originalOrderRef.current = null;
    }
    dragCurrentIndexRef.current = null;
    setDragIndex(null);
  }

  if (loading) {
    return <div className="character-list__loading">Loading characters...</div>;
  }

  if (showRecycleBin) {
    return (
      <div className="character-list" ref={listRef}>
        <CharacterRecycleBin
          onBack={() => setShowRecycleBin(false)}
          onChanged={refresh}
        />
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="character-list character-list--empty" ref={listRef}>
        <div className="character-list__empty">
          <svg
            className="character-list__empty-mark"
            viewBox="0 0 64 64"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {/* Plume outline — leaf-shaped silhouette tilted along the spine. */}
            <path d="M 48 12 C 54 14, 53 22, 48 28 C 42 36, 36 38, 30 38 C 30 32, 32 24, 36 18 C 40 13, 44 11, 48 12 Z" />
            {/* Spine — runs through the plume and extends past it to the writing tip. */}
            <path d="M 48 12 C 40 24, 32 36, 22 50" />
            {/* Cross-veins — five short curves suggesting barb texture inside the plume. */}
            <path d="M 49 13 Q 44 17, 38 16" />
            <path d="M 48 19 Q 41 22, 35 22" />
            <path d="M 44 26 Q 37 28, 32 28" />
            <path d="M 39 32 Q 33 33, 30 33" />
            <path d="M 35 36 Q 31 37, 29 36" />
            {/* Ink drop at the writing tip. */}
            <path d="M 22 50 C 20 52, 19 54, 22 54 C 25 54, 24 52, 22 50 Z" />
          </svg>
          <span className="character-list__empty-eyebrow">The Codex Awaits</span>
          <h2 className="character-list__empty-title">No characters yet</h2>
          <p className="character-list__empty-sub">
            Every world begins with a single name.
          </p>
          <span className="character-list__empty-fleuron" aria-hidden="true">❧</span>
          <button
            className="character-list__primary-btn character-list__empty-cta"
            onClick={handleCreate}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <span>Inscribe the first character</span>
          </button>
          <button
            className="character-list__empty-link"
            onClick={() => setShowRecycleBin(true)}
          >
            Recycle Bin
          </button>
        </div>
        {showCreateDialog && (
          <CharacterCreateDialog
            worldType={activeWorld?.world_type ?? 'Custom'}
            onClose={() => setShowCreateDialog(false)}
            onCreate={handleCreateComplete}
          />
        )}
      </div>
    );
  }

  const dragEnabled =
    editMode && !searchQuery && activeTags.size === 0 && sortMode === 'manual';

  return (
    <div className="character-list" ref={listRef}>
      <header className="character-list__page-header">
        <span className="character-list__eyebrow">The Character Codex</span>
        <span className="character-list__eyebrow-rule" aria-hidden="true" />
      </header>

      <div className="character-list__toolbar">
        <input
          className="character-list__search"
          type="text"
          placeholder="Search the codex…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="character-list__sort-wrap">
          <svg
            className="character-list__sort-icon"
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path d="M4 3v10M4 3L2 5M4 3l2 2M12 13V3M12 13l-2-2M12 13l2-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <select
            className="character-list__sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            title="Sort order"
            aria-label="Sort order"
          >
            {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => (
              <option key={m} value={m}>{SORT_LABEL[m]}</option>
            ))}
          </select>
        </div>
        <button
          className="character-list__icon-btn"
          onClick={() => setShowTypographySettings(true)}
          title="Typography"
          aria-label="Typography settings"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 13 L 6.5 3 L 9.5 3 L 13 13 M 5 9.5 L 11 9.5"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="character-list__icon-btn"
          onClick={() => setShowRecycleBin(true)}
          title="Recycle Bin"
          aria-label="Recycle Bin"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 5h10M6.5 5V3.5a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V5M4.5 5l.6 7.4a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9L11.5 5M7 7.5v4M9 7.5v4"
              stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button className="character-list__primary-btn" onClick={handleCreate}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span>New Character</span>
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="character-list__tags">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`character-list__tag ${activeTags.has(tag) ? 'character-list__tag--active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
          {activeTags.size > 0 && (
            <button
              className="character-list__tag character-list__tag--clear"
              onClick={() => setActiveTags(new Set())}
            >
              Clear ({activeTags.size})
            </button>
          )}
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="character-list__bulk-bar">
          <span className="character-list__bulk-count">
            {selectedIds.size} selected
          </span>
          <button
            className="btn btn--ghost"
            onClick={() => setBulkDeleteOpen(true)}
          >
            Delete
          </button>
          {showBulkTagInput ? (
            <>
              <input
                className="character-list__bulk-tag-input"
                placeholder="Tag to add..."
                value={bulkTagInput}
                autoFocus
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBulkAddTag();
                  else if (e.key === 'Escape') {
                    setBulkTagInput('');
                    setShowBulkTagInput(false);
                  }
                }}
              />
              <button className="btn btn--primary" onClick={handleBulkAddTag}>
                Apply
              </button>
            </>
          ) : (
            <button
              className="btn btn--ghost"
              onClick={() => setShowBulkTagInput(true)}
            >
              + Tag
            </button>
          )}
          <button
            className="btn btn--ghost"
            onClick={() => {
              setSelectedIds(new Set());
              setLastSelectedIndex(null);
              setShowBulkTagInput(false);
              setBulkTagInput('');
            }}
          >
            Clear Selection
          </button>
        </div>
      )}

      <div className="character-list__grid">
        {filteredCharacters.map((char, index) => {
          const isSelected = selectedIds.has(char.id);
          return (
            <div
              key={char.id}
              className={`character-list__card ${dragIndex === index ? 'character-list__card--dragging' : ''} ${isSelected ? 'character-list__card--selected' : ''}`}
              onClick={(e) => handleCardClick(e, char, index)}
              draggable={dragEnabled}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
            >
              {char.decorative_ribbon && (
                <div
                  className="character-list__card-ribbon"
                  style={{ backgroundColor: char.decorative_ribbon }}
                />
              )}
              {dragEnabled && (
                <span
                  className="character-list__card-drag-handle"
                  aria-hidden="true"
                  title="Drag to reorder"
                >
                  ⋮⋮
                </span>
              )}
              <div className="character-list__card-image">
                {(() => {
                  const url = char.image_asset_id ? getImageUrl(char.image_asset_id) : null;
                  return url ? (
                    <img src={url} alt={char.name} draggable={false} />
                  ) : (
                    <div className="character-list__card-placeholder">&#9823;</div>
                  );
                })()}
              </div>
              <div className="character-list__card-info">
                <span className="character-list__card-name">{char.name}</span>
                {char.short_role && (
                  <span className="character-list__card-role">{char.short_role}</span>
                )}
              </div>
              {editMode && selectedIds.size === 0 && (
                <button
                  className="character-list__card-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(char);
                  }}
                  title="Delete character"
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showCreateDialog && (
        <CharacterCreateDialog
          worldType={activeWorld?.world_type ?? 'Custom'}
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreateComplete}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Character"
          message={`Are you sure you want to delete "${deleteTarget.name}"? It will be moved to the recycle bin for 24 hours.`}
          confirmLabel="Delete"
          confirmDanger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {bulkDeleteOpen && (
        <ConfirmDialog
          title="Delete Characters"
          message={`Delete ${selectedIds.size} character${selectedIds.size === 1 ? '' : 's'}? They will be moved to the recycle bin for 24 hours.`}
          confirmLabel="Delete All"
          confirmDanger
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteOpen(false)}
        />
      )}

      {showTypographySettings && (
        <CharacterTypographySettings
          settings={typography.settings}
          onChange={typography.update}
          onReset={typography.reset}
          onClose={() => setShowTypographySettings(false)}
        />
      )}
    </div>
  );
}
