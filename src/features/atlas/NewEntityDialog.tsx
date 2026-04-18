import { useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { commands } from '../../lib/commands';
import type { MapEntityFull, MapEntityType } from '../../lib/commands';

const ENTITY_TYPES: { id: MapEntityType; label: string }[] = [
  { id: 'region', label: 'Region' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'landmark', label: 'Landmark' },
  { id: 'district', label: 'District' },
  { id: 'infrastructure', label: 'Infrastructure' },
];

const MAX_PARENT_DEPTH = 5;

function computeEntityLevel(entityId: string, entities: MapEntityFull[]): number {
  let level = 1;
  const visited = new Set<string>([entityId]);
  let current = entities.find((e) => e.id === entityId);
  while (current?.parent_map_entity_id) {
    const pid = current.parent_map_entity_id;
    if (visited.has(pid)) break;
    visited.add(pid);
    level++;
    if (level > MAX_PARENT_DEPTH + 5) break;
    current = entities.find((e) => e.id === pid);
  }
  return level;
}

export interface NewEntityDraft {
  entityType: MapEntityType;
  title: string;
  description: string;
  parentMapEntityId: string | null;
  tagsText: string;
  imageAssetId: string | null;
}

interface NewEntityDialogProps {
  existingEntities: MapEntityFull[];
  onPlace: (draft: NewEntityDraft) => void;
  onCancel: () => void;
}

export function NewEntityDialog({
  existingEntities,
  onPlace,
  onCancel,
}: NewEntityDialogProps) {
  const [entityType, setEntityType] = useState<MapEntityType>('region');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [tags, setTags] = useState('');
  const [imageAssetId, setImageAssetId] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  async function handlePickImage() {
    try {
      const selected = await open({
        title: 'Choose entity image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (!selected) return;
      const path = selected as string;
      const assetId = await commands.importAsset(path);
      setImageAssetId(assetId);
      setImagePath(path);
    } catch (err) {
      console.error('Failed to import image:', err);
    }
  }

  function handlePlace() {
    if (!title.trim()) {
      setTitleError(true);
      titleRef.current?.focus();
      return;
    }
    onPlace({
      entityType,
      title: title.trim(),
      description: description.trim(),
      parentMapEntityId: parentId || null,
      tagsText: tags.trim(),
      imageAssetId,
    });
  }

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2 className="dialog__title">New Map Entity</h2>

        <div className="dialog__field">
          <label className="dialog__label">
            Type <span className="dialog__required">*</span>
          </label>
          <select
            className="dialog__select"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as MapEntityType)}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="dialog__field">
          <label className="dialog__label">
            Title <span className="dialog__required">*</span>
          </label>
          <input
            ref={titleRef}
            className={`dialog__input ${titleError ? 'dialog__input--error' : ''}`}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (titleError) setTitleError(false);
            }}
            placeholder="e.g. Thornwatch Keep"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePlace();
            }}
          />
          {titleError && <span className="dialog__error">Title is required</span>}
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Description</label>
          <textarea
            className="dialog__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description…"
            rows={3}
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Parent entity</label>
          <select
            className="dialog__select"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">— None —</option>
            {existingEntities.map((e) => {
              // A new entity placed under this parent would land one level
              // below it. Disable options that would push the chain past
              // the MAX_PARENT_DEPTH limit so the user sees the constraint
              // before committing.
              const level = computeEntityLevel(e.id, existingEntities);
              const wouldExceed = level + 1 > MAX_PARENT_DEPTH;
              return (
                <option
                  key={e.id}
                  value={e.id}
                  disabled={wouldExceed}
                  style={wouldExceed ? { color: 'var(--text-muted)' } : undefined}
                >
                  {e.title} [{e.entity_type}]
                  {wouldExceed ? '  --  Δ Maximum Depth Reached' : ''}
                </option>
              );
            })}
          </select>
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Tags (comma-separated)</label>
          <input
            className="dialog__input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. capital, coastal, ruins"
          />
        </div>

        <div className="dialog__field">
          <label className="dialog__label">Image (optional)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handlePickImage}
            >
              {imagePath ? 'Change image…' : 'Choose image…'}
            </button>
            {imagePath && (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Image attached
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setImagePath(null);
                    setImageAssetId(null);
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>

        <div className="dialog__actions">
          <button className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn--primary"
            onClick={handlePlace}
            disabled={!title.trim()}
          >
            Place on Map
          </button>
        </div>
      </div>
    </div>
  );
}
