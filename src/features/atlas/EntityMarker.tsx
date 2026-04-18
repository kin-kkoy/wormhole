import { useEffect, useState } from 'react';
import type { MapEntityFull } from '../../lib/commands';
import { commands } from '../../lib/commands';

interface EntityMarkerProps {
  entity: MapEntityFull;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  accentColor: string;
}

const TYPE_ICONS: Record<string, string> = {
  region: '◈',
  settlement: '⌂',
  landmark: '✦',
  district: '▣',
  infrastructure: '⚙',
};

const TYPE_LABELS: Record<string, string> = {
  region: 'Region',
  settlement: 'Settlement',
  landmark: 'Landmark',
  district: 'District',
  infrastructure: 'Infrastructure',
};

export function EntityMarker({
  entity,
  selected,
  onPointerDown,
  accentColor,
}: EntityMarkerProps) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!entity.image_asset_id) {
      setImgUrl(null);
      return;
    }
    (async () => {
      try {
        const asset = await commands.getAsset(entity.image_asset_id!);
        if (cancelled) return;
        setImgUrl(`data:${asset.mime_type};base64,${asset.data_base64}`);
      } catch {
        if (!cancelled) setImgUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity.image_asset_id]);

  const icon = TYPE_ICONS[entity.entity_type] ?? '◈';
  const typeLabel = TYPE_LABELS[entity.entity_type] ?? entity.entity_type;

  return (
    <div
      className={`atlas-marker ${selected ? 'atlas-marker--selected' : ''}`}
      data-entity-drag
      style={{
        left: entity.x,
        top: entity.y,
        borderColor: selected ? accentColor : undefined,
      }}
      onPointerDown={(e) => {
        // Don't select here — selection happens in AtlasCanvas's pointerup
        // handler only when the gesture turned out to be a click (not a drag),
        // so the panel doesn't pop up mid-drag.
        e.stopPropagation();
        onPointerDown(e);
      }}
      onClick={(e) => {
        // Prevent the outer canvas click handler from deselecting this marker.
        e.stopPropagation();
      }}
      title={`${entity.title} — ${typeLabel}`}
    >
      <div className="atlas-marker__disc">
        {imgUrl ? (
          <img src={imgUrl} alt="" className="atlas-marker__img" />
        ) : (
          <span className="atlas-marker__icon" style={{ color: accentColor }}>
            {icon}
          </span>
        )}
      </div>
      <div className="atlas-marker__label">{entity.title}</div>
    </div>
  );
}
