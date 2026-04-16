import { useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import './LinkedRecords.css';

interface LinkedRecordsProps {
  characterId: string;
}

interface LinkedRecord {
  id: string;
  linkType: string;
  entityType: string;
  entityId: string;
  entityName: string;
}

export function LinkedRecords({ characterId }: LinkedRecordsProps) {
  const [records, setRecords] = useState<LinkedRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Entity links are loaded via graph data for now
    // Full link management is deferred to Step 6
    (async () => {
      try {
        const graphData = await commands.getCharactersGraphData();
        if (cancelled) return;
        const links: LinkedRecord[] = [];

        for (const ll of graphData.location_links) {
          if (ll.character_id === characterId) {
            links.push({
              id: `loc-${ll.map_entity_id}`,
              linkType: ll.link_type,
              entityType: 'map_entity',
              entityId: ll.map_entity_id,
              entityName: ll.map_entity_title,
            });
          }
        }

        setRecords(links);
      } catch {
        // Silently fail - links are optional display
      }
    })();
    return () => { cancelled = true; };
  }, [characterId]);

  if (records.length === 0) return null;

  return (
    <div className="linked-records">
      <h3 className="linked-records__title">Linked Records</h3>
      <div className="linked-records__list">
        {records.map((record) => (
          <div key={record.id} className="linked-records__item">
            <span className="linked-records__item-type">{formatEntityType(record.entityType)}</span>
            <span className="linked-records__item-name">{record.entityName}</span>
            <span className="linked-records__item-link-type">{formatLinkType(record.linkType)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatEntityType(type: string): string {
  switch (type) {
    case 'character': return 'Character';
    case 'map_entity': return 'Location';
    case 'lore_document': return 'Lore';
    default: return type;
  }
}

function formatLinkType(type: string): string {
  return type.replace(/_/g, ' ');
}
