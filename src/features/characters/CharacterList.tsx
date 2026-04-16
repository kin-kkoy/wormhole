import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { commands } from '../../lib/commands';
import type { CharacterSummary } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { useImageCache } from '../../hooks/useImageCache';
import { CharacterCreateDialog } from '../../components/characters/CharacterCreateDialog';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import './CharacterList.css';

export function CharacterList() {
  const [characters, setCharacters] = useState<CharacterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CharacterSummary | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  const setSelectedCharacterId = useAppStore((s) => s.setSelectedCharacterId);
  const editMode = useAppStore((s) => s.editMode);
  const activeWorld = useAppStore((s) => s.activeWorld);
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

  // Extract all unique tags
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

  // Filter characters
  const filteredCharacters = useMemo(() => {
    let result = characters;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (activeTagFilter) {
      result = result.filter((c) => {
        if (!c.tags_text) return false;
        const tags = c.tags_text.split(',').map((t) => t.trim().toLowerCase());
        return tags.includes(activeTagFilter);
      });
    }
    return result;
  }, [characters, searchQuery, activeTagFilter]);

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

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  async function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Only allow reordering on the unfiltered full list
    if (searchQuery || activeTagFilter) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...characters];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setCharacters(reordered);
    setDragIndex(null);
    setDragOverIndex(null);

    try {
      await commands.reorderCharacters(reordered.map((c) => c.id));
    } catch (e) {
      console.error('Failed to reorder:', e);
      await refresh();
    }
  }

  if (loading) {
    return <div className="character-list__loading">Loading characters...</div>;
  }

  if (characters.length === 0) {
    return (
      <div className="character-list__empty">
        <span className="character-list__empty-icon">&#9823;</span>
        <span className="character-list__empty-title">No Characters Yet</span>
        <span className="character-list__empty-sub">
          Create your first character to begin building your world's cast.
        </span>
        <button className="btn btn--primary character-list__create-btn" onClick={handleCreate}>
          + Create Character
        </button>
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

  return (
    <div className="character-list" ref={listRef}>
      <div className="character-list__toolbar">
        <input
          className="character-list__search"
          type="text"
          placeholder="Search characters..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="btn btn--primary" onClick={handleCreate}>
          + Create
        </button>
      </div>

      {allTags.length > 0 && (
        <div className="character-list__tags">
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`character-list__tag ${activeTagFilter === tag ? 'character-list__tag--active' : ''}`}
              onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
            >
              {tag}
            </button>
          ))}
          {activeTagFilter && (
            <button
              className="character-list__tag character-list__tag--clear"
              onClick={() => setActiveTagFilter(null)}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="character-list__grid">
        {filteredCharacters.map((char, index) => (
          <div
            key={char.id}
            className={`character-list__card ${dragOverIndex === index ? 'character-list__card--drag-over' : ''} ${dragIndex === index ? 'character-list__card--dragging' : ''}`}
            onClick={() => setSelectedCharacterId(char.id)}
            draggable={editMode && !searchQuery && !activeTagFilter}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
          >
            {char.decorative_ribbon && (
              <div
                className="character-list__card-ribbon"
                style={{ backgroundColor: char.decorative_ribbon }}
              />
            )}
            <div className="character-list__card-image">
              {char.image_asset_id ? (
                <img
                  src={getImageUrl(char.image_asset_id) || ''}
                  alt={char.name}
                  draggable={false}
                />
              ) : (
                <div className="character-list__card-placeholder">&#9823;</div>
              )}
            </div>
            <div className="character-list__card-info">
              <span className="character-list__card-name">{char.name}</span>
              {char.short_role && (
                <span className="character-list__card-role">{char.short_role}</span>
              )}
            </div>
            {editMode && (
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
        ))}
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
    </div>
  );
}
