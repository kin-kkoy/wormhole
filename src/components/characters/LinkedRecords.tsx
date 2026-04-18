import { useCallback, useEffect, useState } from 'react';
import type { LinkedRecordDisplay } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { LinkPickerDialog } from '../linking/LinkPickerDialog';
import './LinkedRecords.css';

interface LinkedRecordsProps {
  characterId: string;
}

/**
 * Cross-system linked records for a character — locations and lore documents.
 * Character↔character links exist in storage but are intentionally not
 * surfaced here in V1 (see Packet 6 §7).
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
    (l) => l.entity_type === 'map_entity' || l.entity_type === 'lore_document',
  );
  const locationLinks = visibleLinks.filter((l) => l.entity_type === 'map_entity');
  const loreLinks = visibleLinks.filter((l) => l.entity_type === 'lore_document');

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
          allowedTargetTypes={['map_entity', 'lore_document']}
          primaryVariant="characters"
          onClose={() => setShowPicker(false)}
          onLinkCreated={handleLinkCreated}
        />
      )}
    </div>
  );
}

function LinkSection({
  label,
  type,
  items,
  onRemove,
}: {
  label: string;
  type: 'map_entity' | 'lore_document';
  items: LinkedRecordDisplay[];
  onRemove: (linkId: string) => void;
}) {
  return (
    <div className="linked-records__section">
      <div className="linked-records__section-title">{label}</div>
      {items.map((link) => (
        <button
          key={link.link_id}
          type="button"
          className="linked-records__item"
          data-peek-link
          data-entity-type={link.entity_type}
          data-entity-id={link.entity_id}
        >
          <span className="linked-records__item-type" data-type={type}>
            {type === 'map_entity' ? 'LOC' : 'DOC'}
          </span>
          <span className="linked-records__item-name">{link.entity_name}</span>
          <span className="linked-records__item-link-type">{link.link_type}</span>
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
  );
}
