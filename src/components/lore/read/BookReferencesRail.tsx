import { useEffect, useState } from 'react';
import { commands } from '../../../lib/commands';
import type { LinkedRecordDisplay } from '../../../lib/commands';

interface BookReferencesRailProps {
  documentId: string;
  /** "rail" is the right-side column; "inline" is the narrow-viewport fallback below the page. */
  variant: 'rail' | 'inline';
}

export function BookReferencesRail({ documentId, variant }: BookReferencesRailProps) {
  const [links, setLinks] = useState<LinkedRecordDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLinks([]);
    commands
      .listEntityLinks('lore_document', documentId)
      .then((result) => {
        if (cancelled) return;
        setLinks(result);
        setLoading(false);
      })
      .catch((e) => {
        console.error('Failed to load references:', e);
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  const characterLinks = links.filter((l) => l.entity_type === 'character');
  const locationLinks = links.filter((l) => l.entity_type === 'map_entity');
  const documentLinks = links.filter((l) => l.entity_type === 'lore_document');

  if (loading && variant === 'rail') {
    return (
      <div className="book-refs">
        <h3 className="book-refs__title">References</h3>
        <div className="book-refs__empty">Loading…</div>
      </div>
    );
  }

  if (links.length === 0) {
    if (variant === 'inline') return null;
    return (
      <div className="book-refs">
        <h3 className="book-refs__title">References</h3>
        <div className="book-refs__empty">No linked records.</div>
      </div>
    );
  }

  return (
    <div className="book-refs">
      {variant === 'rail' && <h3 className="book-refs__title">References</h3>}
      {characterLinks.length > 0 && (
        <Section title="Characters" items={characterLinks} />
      )}
      {locationLinks.length > 0 && (
        <Section title="Locations" items={locationLinks} />
      )}
      {documentLinks.length > 0 && (
        <Section title="Documents" items={documentLinks} />
      )}
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: LinkedRecordDisplay[];
}) {
  return (
    <div className="book-refs__section">
      <div className="book-refs__section-title">{title}</div>
      {items.map((link) => {
        const badge =
          link.entity_type === 'character'
            ? 'CHR'
            : link.entity_type === 'map_entity'
              ? 'LOC'
              : 'DOC';
        return (
          <div
            key={link.link_id}
            className="book-refs__item"
            data-peek-link
            data-entity-type={link.entity_type}
            data-entity-id={link.entity_id}
            role="button"
            tabIndex={0}
            title={`Open ${link.entity_name}`}
          >
            <span className="book-refs__badge" data-type={link.entity_type}>
              {badge}
            </span>
            <span className="book-refs__item-name">{link.entity_name}</span>
          </div>
        );
      })}
    </div>
  );
}
