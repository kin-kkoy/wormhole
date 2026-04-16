import { useState, useEffect, useCallback } from 'react';
import type { LinkedRecordDisplay } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { LinkPickerDialog } from './LinkPickerDialog';
import './LinkedRecordsPanel.css';

interface LinkedRecordsPanelProps {
  documentId: string;
  onRefresh: () => void;
}

export function LinkedRecordsPanel({ documentId, onRefresh }: LinkedRecordsPanelProps) {
  const [links, setLinks] = useState<LinkedRecordDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  const loadLinks = useCallback(async () => {
    try {
      const result = await commands.listEntityLinks('lore_document', documentId);
      setLinks(result);
    } catch (e) {
      console.error('Failed to load links:', e);
    }
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    setLinks([]); // Clear stale data immediately on document switch
    setLoading(true);
    loadLinks();
  }, [loadLinks]);

  async function handleRemoveLink(linkId: string) {
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
    onRefresh();
  }

  const characterLinks = links.filter((l) => l.entity_type === 'character');
  const locationLinks = links.filter((l) => l.entity_type === 'map_entity');
  const documentLinks = links.filter((l) => l.entity_type === 'lore_document');

  return (
    <div className="linked-records">
      <div className="linked-records__header">
        <span className="linked-records__title">Linked Records</span>
        <button
          className="linked-records__add-btn"
          title="Add Link"
          onClick={() => setShowPicker(true)}
        >
          <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
            <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="linked-records__empty">Loading...</div>
      ) : links.length === 0 ? (
        <div className="linked-records__empty">
          <span>No linked records</span>
          <span>Click + to add one</span>
        </div>
      ) : (
        <div className="linked-records__content">
          {characterLinks.length > 0 && (
            <div className="linked-records__section">
              <div className="linked-records__section-title">Characters</div>
              {characterLinks.map((link) => (
                <LinkItem key={link.link_id} link={link} onRemove={handleRemoveLink} />
              ))}
            </div>
          )}
          {locationLinks.length > 0 && (
            <div className="linked-records__section">
              <div className="linked-records__section-title">Locations</div>
              {locationLinks.map((link) => (
                <LinkItem key={link.link_id} link={link} onRemove={handleRemoveLink} />
              ))}
            </div>
          )}
          {documentLinks.length > 0 && (
            <div className="linked-records__section">
              <div className="linked-records__section-title">Documents</div>
              {documentLinks.map((link) => (
                <LinkItem key={link.link_id} link={link} onRemove={handleRemoveLink} />
              ))}
            </div>
          )}
        </div>
      )}

      {showPicker && (
        <LinkPickerDialog
          sourceType="lore_document"
          sourceId={documentId}
          onClose={() => setShowPicker(false)}
          onLinkCreated={handleLinkCreated}
        />
      )}
    </div>
  );
}

function LinkItem({
  link,
  onRemove,
}: {
  link: LinkedRecordDisplay;
  onRemove: (linkId: string) => void;
}) {
  const badgeLabel =
    link.entity_type === 'character'
      ? 'CHR'
      : link.entity_type === 'map_entity'
        ? 'LOC'
        : 'DOC';

  return (
    <div className="linked-records__item">
      <span className="linked-records__badge" data-type={link.entity_type}>
        {badgeLabel}
      </span>
      <div className="linked-records__item-info">
        <span className="linked-records__item-name">{link.entity_name}</span>
        <span className="linked-records__item-type">{link.link_type}</span>
      </div>
      <button
        className="linked-records__remove-btn"
        title="Remove link"
        onClick={() => onRemove(link.link_id)}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
          <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
        </svg>
      </button>
    </div>
  );
}
