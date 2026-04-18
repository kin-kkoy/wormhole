import { useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import { CANVAS_SIZE } from './coords';

interface BaseMapLayerProps {
  assetId: string | null;
}

/**
 * Optional base map image layer. Uses the asset-by-id BLOB retrieval from
 * the backend. Centers the image inside the canvas with aspect preserved.
 */
export function BaseMapLayer({ assetId }: BaseMapLayerProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!assetId) {
      setDataUrl(null);
      return;
    }
    (async () => {
      try {
        const asset = await commands.getAsset(assetId);
        if (cancelled) return;
        setDataUrl(`data:${asset.mime_type};base64,${asset.data_base64}`);
      } catch (err) {
        console.error('Failed to load base map:', err);
        if (!cancelled) setDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId]);

  if (!dataUrl) return null;

  return (
    <div
      className="atlas-basemap"
      style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
      aria-hidden="true"
    >
      <img src={dataUrl} alt="Base map" className="atlas-basemap__img" />
    </div>
  );
}
