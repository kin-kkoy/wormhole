import { useEffect, useRef, useState } from 'react';
import { commands } from '../../lib/commands';
import type {
  LinkableRecord,
  LinkedRecordDisplay,
  MapEntityFull,
  MapEntityType,
} from '../../lib/commands';
import { TipTapEditor } from '../../components/editor/TipTapEditor';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import './AtlasEntityPanel.css';

const ENTITY_TYPES: { id: MapEntityType; label: string }[] = [
  { id: 'region', label: 'Region' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'landmark', label: 'Landmark' },
  { id: 'district', label: 'District' },
  { id: 'infrastructure', label: 'Infrastructure' },
];

// Suggested link types from Packet 06. Users can pick one or type a custom
// value. These match the backend's free-form link_type TEXT column — no
// enum constraint, so custom values work.
const LINK_TYPE_SUGGESTIONS = [
  'related_to',
  'resident_in',
  'ruler_of',
  'born_in',
  'active_in',
  'located_in',
  'appears_in',
  'tied_to_event',
  'reference',
];

const MAX_PARENT_DEPTH = 5; // mirrors backend constant

function computeEntityLevel(entityId: string, entities: MapEntityFull[]): number {
  // Returns 1-indexed depth from root. Uses a visited set to guard against
  // malformed cycles (shouldn't exist, but be defensive).
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

function computeSubtreeDepth(entityId: string, entities: MapEntityFull[]): number {
  // Returns the max chain length BELOW this entity (0 if leaf).
  const children = entities.filter((e) => e.parent_map_entity_id === entityId);
  if (children.length === 0) return 0;
  return 1 + Math.max(...children.map((c) => computeSubtreeDepth(c.id, entities)));
}

function collectDescendants(
  entityId: string,
  entities: MapEntityFull[],
): Set<string> {
  const out = new Set<string>();
  const queue = [entityId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const e of entities) {
      if (e.parent_map_entity_id === id && !out.has(e.id)) {
        out.add(e.id);
        queue.push(e.id);
      }
    }
  }
  return out;
}

interface AtlasEntityPanelProps {
  entity: MapEntityFull;
  allEntities: MapEntityFull[];
  onClose: () => void;
  onUpdated: (entity: MapEntityFull) => void;
  onDeleted: (entityId: string) => void;
}

export function AtlasEntityPanel({
  entity,
  allEntities,
  onClose,
  onUpdated,
  onDeleted,
}: AtlasEntityPanelProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(entity.title);
  const [entityType, setEntityType] = useState<MapEntityType>(entity.entity_type as MapEntityType);
  const [description, setDescription] = useState(entity.description ?? '');
  const [parentId, setParentId] = useState<string>(entity.parent_map_entity_id ?? '');
  const [tags, setTags] = useState(entity.tags_text ?? '');
  const [links, setLinks] = useState<LinkedRecordDisplay[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [addingLinkFor, setAddingLinkFor] = useState<'character' | 'lore_document' | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<LinkableRecord[]>([]);
  const [newLinkType, setNewLinkType] = useState<string>('related_to');
  const [charsExpanded, setCharsExpanded] = useState(false);
  const [loreExpanded, setLoreExpanded] = useState(false);

  // Track the latest description for save-time read (TipTap pushes changes
  // on a 300ms debounce, so `description` state may lag briefly).
  const descriptionRef = useRef(description);
  useEffect(() => {
    descriptionRef.current = description;
  }, [description]);

  // Sync form state whenever the displayed entity changes
  useEffect(() => {
    setTitle(entity.title);
    setEntityType(entity.entity_type as MapEntityType);
    setDescription(entity.description ?? '');
    setParentId(entity.parent_map_entity_id ?? '');
    setTags(entity.tags_text ?? '');
    setEditing(false);
    setErrorMsg(null);
  }, [entity.id, entity.title, entity.entity_type, entity.description, entity.parent_map_entity_id, entity.tags_text]);

  // When user cancels editing, discard unsaved field changes so the panel
  // reflects the stored entity on re-entry.
  function handleCancelEdit() {
    setTitle(entity.title);
    setEntityType(entity.entity_type as MapEntityType);
    setDescription(entity.description ?? '');
    setParentId(entity.parent_map_entity_id ?? '');
    setTags(entity.tags_text ?? '');
    setErrorMsg(null);
    setEditing(false);
  }

  // Load linked records
  useEffect(() => {
    let cancelled = false;
    commands
      .listEntityLinks('map_entity', entity.id)
      .then((result) => {
        if (!cancelled) setLinks(result);
      })
      .catch((err) => console.error('Failed to load links:', err));
    return () => {
      cancelled = true;
    };
  }, [entity.id]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editing) {
          handleCancelEdit();
        } else if (addingLinkFor) {
          setAddingLinkFor(null);
        } else if (!confirmingDelete) {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, addingLinkFor, confirmingDelete, onClose]);

  async function handleSave() {
    if (!title.trim()) {
      setErrorMsg('Title is required');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      // The TipTap editor uses a 300ms debounce before pushing content up to
      // this component's `description` state. If the user clicks Save too
      // quickly, the latest typed text may not have flushed yet. Wait a beat
      // to let it land; we read the latest state via a ref below.
      await new Promise((resolve) => setTimeout(resolve, 350));
      const latestDescription = descriptionRef.current;
      const updated = await commands.updateMapEntity({
        entityId: entity.id,
        title: title.trim(),
        entityType,
        description: latestDescription,
        parentMapEntityId: parentId || undefined,
        clearParent: !parentId,
        tagsText: tags,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setErrorMsg(typeof err === 'string' ? err : 'Failed to save entity');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await commands.deleteMapEntity(entity.id);
      onDeleted(entity.id);
    } catch (err) {
      console.error('Failed to delete entity:', err);
      setErrorMsg(typeof err === 'string' ? err : 'Failed to delete entity');
    }
  }

  async function refreshLinks() {
    try {
      const result = await commands.listEntityLinks('map_entity', entity.id);
      setLinks(result);
    } catch (err) {
      console.error('Failed to reload links:', err);
    }
  }

  async function handleSearchLinks(q: string) {
    setLinkSearch(q);
    if (!q.trim()) {
      setLinkResults([]);
      return;
    }
    try {
      const results = await commands.searchLinkableRecords({
        query: q,
        excludeType: 'map_entity',
        excludeId: entity.id,
      });
      const typeFilter = addingLinkFor;
      setLinkResults(
        typeFilter ? results.filter((r) => r.entity_type === typeFilter) : results,
      );
    } catch (err) {
      console.error('Failed to search linkable records:', err);
    }
  }

  async function handleAddLink(record: LinkableRecord) {
    const trimmedType = newLinkType.trim();
    try {
      await commands.createEntityLink({
        sourceType: 'map_entity',
        sourceId: entity.id,
        targetType: record.entity_type,
        targetId: record.id,
        linkType: trimmedType || undefined,
      });
      setLinkSearch('');
      setLinkResults([]);
      setAddingLinkFor(null);
      setNewLinkType('related_to');
      await refreshLinks();
    } catch (err) {
      console.error('Failed to create link:', err);
      setErrorMsg(typeof err === 'string' ? err : 'Failed to create link');
    }
  }

  async function handleRemoveLink(linkId: string) {
    try {
      await commands.deleteEntityLink(linkId);
      await refreshLinks();
    } catch (err) {
      console.error('Failed to remove link:', err);
    }
  }

  const characterLinks = links.filter((l) => l.entity_type === 'character');
  const loreLinks = links.filter((l) => l.entity_type === 'lore_document');

  const parentEntity = entity.parent_map_entity_id
    ? allEntities.find((e) => e.id === entity.parent_map_entity_id)
    : null;

  return (
    <>
      <aside className="atlas-panel" data-no-pan>
        <div className="atlas-panel__header">
          <div className="atlas-panel__type">{entity.entity_type}</div>
          <button className="atlas-panel__close" onClick={onClose} aria-label="Close panel">
            ×
          </button>
        </div>

        {editing ? (
          <>
            <div className="atlas-panel__field">
              <label className="dialog__label">Title</label>
              <input
                className="dialog__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="atlas-panel__field">
              <label className="dialog__label">Type</label>
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
            <div className="atlas-panel__field">
              <label className="dialog__label">Parent entity</label>
              <select
                className="dialog__select"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">— None —</option>
                {(() => {
                  const subtree = computeSubtreeDepth(entity.id, allEntities);
                  const descendants = collectDescendants(entity.id, allEntities);
                  return allEntities
                    .filter((e) => e.id !== entity.id)
                    .map((e) => {
                      const isDescendant = descendants.has(e.id);
                      const parentLevel = computeEntityLevel(e.id, allEntities);
                      // Backend allows when parentLevel + subtree + 1 <= MAX_PARENT_DEPTH
                      const wouldExceed =
                        parentLevel + subtree + 1 > MAX_PARENT_DEPTH;
                      const disabled = isDescendant || wouldExceed;
                      const hint = isDescendant
                        ? '  --  Δ Would Create Cycle'
                        : wouldExceed
                          ? '  --  Δ Maximum Depth Reached'
                          : '';
                      return (
                        <option
                          key={e.id}
                          value={e.id}
                          disabled={disabled}
                          style={disabled ? { color: 'var(--text-muted)' } : undefined}
                        >
                          {e.title} [{e.entity_type}]{hint}
                        </option>
                      );
                    });
                })()}
              </select>
            </div>
            <div className="atlas-panel__field">
              <label className="dialog__label">Tags</label>
              <input
                className="dialog__input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma-separated"
              />
            </div>
          </>
        ) : (
          <>
            <h2 className="atlas-panel__title">{entity.title}</h2>
            {parentEntity && (
              <div className="atlas-panel__meta">
                Inside <strong>{parentEntity.title}</strong>
              </div>
            )}
            {entity.tags_text && (
              <div className="atlas-panel__tags">
                {entity.tags_text
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <span key={tag} className="atlas-panel__tag">
                      {tag}
                    </span>
                  ))}
              </div>
            )}
          </>
        )}

        <div className="atlas-panel__field">
          <label className="dialog__label">Description</label>
          <TipTapEditor
            content={description}
            editable={editing}
            onUpdate={(json) => setDescription(json)}
            placeholder={editing ? 'Describe this place…' : undefined}
            className="atlas-panel__desc"
          />
        </div>

        <section className={`atlas-panel__section ${charsExpanded ? 'atlas-panel__section--open' : ''}`}>
          <button
            type="button"
            className="atlas-panel__section-header"
            onClick={() => setCharsExpanded((e) => !e)}
            aria-expanded={charsExpanded}
          >
            <svg
              className={`atlas-panel__chev ${charsExpanded ? 'atlas-panel__chev--open' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3>Linked characters</h3>
            {characterLinks.length > 0 && <span className="atlas-panel__chip">{characterLinks.length}</span>}
            <span
              className="btn btn--ghost btn--tiny atlas-panel__section-add"
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                setCharsExpanded(true);
                setAddingLinkFor(addingLinkFor === 'character' ? null : 'character');
                setLinkSearch('');
                setLinkResults([]);
              }}
            >
              {addingLinkFor === 'character' ? 'Done' : '+ Add'}
            </span>
          </button>
          {charsExpanded && (
            <div className="atlas-panel__section-body">
              {addingLinkFor === 'character' && (
                <LinkSearch
                  value={linkSearch}
                  onSearch={handleSearchLinks}
                  results={linkResults}
                  onPick={handleAddLink}
                  placeholder="Search characters…"
                  linkType={newLinkType}
                  onLinkTypeChange={setNewLinkType}
                />
              )}
              {characterLinks.length === 0 ? (
                <p className="atlas-panel__empty">No linked characters.</p>
              ) : (
                <ul className="atlas-panel__list">
                  {characterLinks.map((l) => (
                    <li
                      key={l.link_id}
                      data-peek-link
                      data-entity-type={l.entity_type}
                      data-entity-id={l.entity_id}
                      role="button"
                      tabIndex={0}
                      title={`Open ${l.entity_name}`}
                    >
                      <span className="atlas-panel__link-name">{l.entity_name}</span>
                      <span className="atlas-panel__link-type">{l.link_type}</span>
                      <button
                        className="btn btn--ghost btn--tiny"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLink(l.link_id);
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className={`atlas-panel__section ${loreExpanded ? 'atlas-panel__section--open' : ''}`}>
          <button
            type="button"
            className="atlas-panel__section-header"
            onClick={() => setLoreExpanded((e) => !e)}
            aria-expanded={loreExpanded}
          >
            <svg
              className={`atlas-panel__chev ${loreExpanded ? 'atlas-panel__chev--open' : ''}`}
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
            >
              <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3>Linked lore</h3>
            {loreLinks.length > 0 && <span className="atlas-panel__chip">{loreLinks.length}</span>}
            <span
              className="btn btn--ghost btn--tiny atlas-panel__section-add"
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                setLoreExpanded(true);
                setAddingLinkFor(addingLinkFor === 'lore_document' ? null : 'lore_document');
                setLinkSearch('');
                setLinkResults([]);
              }}
            >
              {addingLinkFor === 'lore_document' ? 'Done' : '+ Add'}
            </span>
          </button>
          {loreExpanded && (
            <div className="atlas-panel__section-body">
              {addingLinkFor === 'lore_document' && (
                <LinkSearch
                  value={linkSearch}
                  onSearch={handleSearchLinks}
                  results={linkResults}
                  onPick={handleAddLink}
                  placeholder="Search lore documents…"
                  linkType={newLinkType}
                  onLinkTypeChange={setNewLinkType}
                />
              )}
              {loreLinks.length === 0 ? (
                <p className="atlas-panel__empty">No linked lore documents.</p>
              ) : (
                <ul className="atlas-panel__list">
                  {loreLinks.map((l) => (
                    <li
                      key={l.link_id}
                      data-peek-link
                      data-entity-type={l.entity_type}
                      data-entity-id={l.entity_id}
                      role="button"
                      tabIndex={0}
                      title={`Open ${l.entity_name}`}
                    >
                      <span className="atlas-panel__link-name">{l.entity_name}</span>
                      <span className="atlas-panel__link-type">{l.link_type}</span>
                      <button
                        className="btn btn--ghost btn--tiny"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveLink(l.link_id);
                        }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {errorMsg && <p className="atlas-panel__error">{errorMsg}</p>}

        <div className="atlas-panel__actions">
          {editing ? (
            <>
              <button
                className="btn btn--ghost"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn--danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </button>
              <button className="btn btn--primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          )}
        </div>
      </aside>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete map entity?"
          message={
            `"${entity.title}" and any child entities will be moved to the recycle bin. ` +
            `They can be recovered within 24 hours.`
          }
          confirmLabel="Delete"
          confirmDanger
          onConfirm={() => {
            setConfirmingDelete(false);
            handleDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}

interface LinkSearchProps {
  value: string;
  onSearch: (q: string) => void;
  results: LinkableRecord[];
  onPick: (r: LinkableRecord) => void;
  placeholder: string;
  linkType: string;
  onLinkTypeChange: (t: string) => void;
}

function LinkSearch({
  value,
  onSearch,
  results,
  onPick,
  placeholder,
  linkType,
  onLinkTypeChange,
}: LinkSearchProps) {
  // Treat the current linkType as custom if it's not in the suggestions list.
  const isCustom = !LINK_TYPE_SUGGESTIONS.includes(linkType);
  const [useCustom, setUseCustom] = useState(isCustom);
  return (
    <div className="atlas-panel__link-search">
      <label className="atlas-panel__link-type-row">
        <span className="atlas-panel__link-type-label">Type</span>
        {useCustom ? (
          <input
            className="dialog__input atlas-panel__link-type-input"
            value={linkType}
            onChange={(e) => onLinkTypeChange(e.target.value)}
            placeholder="custom_type"
          />
        ) : (
          <select
            className="dialog__select atlas-panel__link-type-select"
            value={linkType}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                setUseCustom(true);
                onLinkTypeChange('');
              } else {
                onLinkTypeChange(e.target.value);
              }
            }}
          >
            {LINK_TYPE_SUGGESTIONS.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
        )}
        {useCustom && (
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            onClick={() => {
              setUseCustom(false);
              onLinkTypeChange('related_to');
            }}
          >
            Use preset
          </button>
        )}
      </label>
      <input
        className="dialog__input"
        value={value}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder}
        autoFocus
      />
      {results.length > 0 && (
        <ul className="atlas-panel__link-results">
          {results.map((r) => (
            <li key={`${r.entity_type}-${r.id}`}>
              <button className="atlas-panel__link-pick" onClick={() => onPick(r)}>
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
