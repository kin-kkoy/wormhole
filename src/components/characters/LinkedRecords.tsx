import { useCallback, useEffect, useState } from 'react';
import type { LinkedRecordDisplay } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { LinkPickerDialog } from '../linking/LinkPickerDialog';
import './LinkedRecords.css';

interface LinkedRecordsProps {
  characterId: string;
}

/**
 * Cross-system linked records for a character — characters, locations, and
 * lore documents. Character↔character links are explicit-direction (the
 * row shown mirrors how the user authored it); we don't auto-mirror A→B
 * onto B's panel.
 */
export function LinkedRecords({ characterId }: LinkedRecordsProps) {
  const [links, setLinks] = useState<LinkedRecordDisplay[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadLinks = useCallback(async () => {
    try {
      const result = await commands.listEntityLinks('character', characterId);
      setLinks(result);
    } catch (e) {
      console.error('Failed to load character links:', e);
    }
    setLoading(false);
  }, [characterId]);

  useEffect(() => {
    setLinks([]);
    setLoading(true);
    loadLinks();
  }, [loadLinks]);

  async function handleRemove(linkId: string) {
    try {
      await commands.deleteEntityLink(linkId);
      loadLinks();
    } catch (e) {
      console.error('Failed to remove link:', e);
    }
  }

  function handleLinkCreated() {
    setShowPicker(false);
    loadLinks();
  }

  const visibleLinks = links.filter(
    (l) =>
      l.entity_type === 'character' ||
      l.entity_type === 'map_entity' ||
      l.entity_type === 'lore_document',
  );
  const characterLinks = visibleLinks.filter((l) => l.entity_type === 'character');
  const locationLinks = visibleLinks.filter((l) => l.entity_type === 'map_entity');
  const loreLinks = visibleLinks.filter((l) => l.entity_type === 'lore_document');

  const existingLinkKeys = new Set(
    visibleLinks.map((l) => `${l.entity_type}:${l.entity_id}`),
  );

  return (
    <div className={`linked-records ${expanded ? 'linked-records--expanded' : ''}`}>
      <button
        type="button"
        className="linked-records__header"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <svg
          className={`linked-records__chev ${expanded ? 'linked-records__chev--open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h3 className="linked-records__title">Linked Records</h3>
        {!loading && visibleLinks.length > 0 && (
          <span className="linked-records__count">{visibleLinks.length}</span>
        )}
        <span
          role="button"
          className="linked-records__add-btn"
          title="Add link"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
            setShowPicker(true);
          }}
        >
          + Add
        </span>
      </button>

      {expanded && (
        <div className="linked-records__body">
          {loading ? (
            <div className="linked-records__empty">Loading…</div>
          ) : visibleLinks.length === 0 ? (
            <div className="linked-records__empty">No linked records yet.</div>
          ) : (
            <div className="linked-records__list">
              {characterLinks.length > 0 && (
                <LinkSection
                  label="Characters"
                  type="character"
                  items={characterLinks}
                  onRemove={handleRemove}
                />
              )}
              {locationLinks.length > 0 && (
                <LinkSection
                  label="Locations"
                  type="map_entity"
                  items={locationLinks}
                  onRemove={handleRemove}
                />
              )}
              {loreLinks.length > 0 && (
                <LinkSection
                  label="Lore"
                  type="lore_document"
                  items={loreLinks}
                  onRemove={handleRemove}
                />
              )}
            </div>
          )}
        </div>
      )}

      {showPicker && (
        <LinkPickerDialog
          sourceType="character"
          sourceId={characterId}
          allowedTargetTypes={['character', 'map_entity', 'lore_document']}
          existingLinkKeys={existingLinkKeys}
          primaryVariant="characters"
          onClose={() => setShowPicker(false)}
          onLinkCreated={handleLinkCreated}
        />
      )}
    </div>
  );
}

function EntityGlyph({ type }: { type: 'character' | 'map_entity' | 'lore_document' }) {
  if (type === 'character') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="5.5" r="2.5" />
        <path d="M3 14 C 3 11, 5 9, 8 9 C 11 9, 13 11, 13 14" />
      </svg>
    );
  }
  if (type === 'map_entity') {
    return (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 14 C 4 10, 2 8, 2 6 A 6 6 0 0 1 14 6 C 14 8, 12 10, 8 14 Z" />
        <circle cx="8" cy="6" r="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 4 L 8 6 L 14 4 L 14 12 L 8 14 L 2 12 Z" />
      <path d="M8 6 L 8 14" />
    </svg>
  );
}

function LinkSection({
  label,
  type,
  items,
  onRemove,
}: {
  label: string;
  type: 'character' | 'map_entity' | 'lore_document';
  items: LinkedRecordDisplay[];
  onRemove: (linkId: string) => void;
}) {
  return (
    <div className="linked-records__section" data-section-type={type}>
      <div className="linked-records__section-header">
        <span className="linked-records__section-glyph" data-type={type}>
          <EntityGlyph type={type} />
        </span>
        <span className="linked-records__section-title">{label}</span>
        <span className="linked-records__section-count">{items.length}</span>
      </div>
      <div className="linked-records__section-items">
        {items.map((link) => (
          <button
            key={link.link_id}
            type="button"
            className="linked-records__item"
            data-peek-link
            data-entity-type={link.entity_type}
            data-entity-id={link.entity_id}
          >
            <span className="linked-records__item-glyph" data-type={type} aria-hidden="true">
              <EntityGlyph type={type} />
            </span>
            <span className="linked-records__item-name">{link.entity_name}</span>
            {link.link_type && (
              <span className="linked-records__item-link-type">
                <svg
                  className="linked-records__arrow"
                  viewBox="0 0 10 10"
                  width="9"
                  height="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M1 5h7.5M5.5 2l3 3-3 3" />
                </svg>
                <span>{link.link_type}</span>
              </span>
            )}
            <span
              className="linked-records__remove"
              role="button"
              aria-label="Remove link"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(link.link_id);
              }}
            >
              ×
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
