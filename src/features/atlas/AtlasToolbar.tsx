import { open } from '@tauri-apps/plugin-dialog';
import { commands } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import type { AtlasTool } from '../../state/store';

interface AtlasToolbarProps {
  baseMapAssetId: string | null;
  onBaseMapChanged: (assetId: string | null) => void;
  onAddEntity: () => void;
  onClearPaint: () => void;
  pendingPlacement: boolean;
}

const TOOLS: { id: AtlasTool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pan', label: 'Pan', icon: '✥' },
  { id: 'brush', label: 'Brush', icon: '✎' },
  { id: 'erase', label: 'Erase', icon: '⌫' },
];

const COLOR_SWATCHES = [
  '#d4a574',
  '#8fbc8f',
  '#6b8fbf',
  '#c48f8f',
  '#b47fb4',
  '#bfbf6b',
  '#7fb3b3',
  '#5a5a5a',
];

export function AtlasToolbar({
  baseMapAssetId,
  onBaseMapChanged,
  onAddEntity,
  onClearPaint,
  pendingPlacement,
}: AtlasToolbarProps) {
  const {
    atlasTool,
    setAtlasTool,
    atlasBrushColor,
    setAtlasBrushColor,
    atlasBrushSize,
    setAtlasBrushSize,
  } = useAppStore();

  async function handlePickBaseMap() {
    try {
      const selected = await open({
        title: 'Choose base map image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }],
      });
      if (!selected) return;
      const path = selected as string;
      // Import asset as BLOB (enforce 4MB cap per spec), then set as base map.
      const FOUR_MB = 4 * 1024 * 1024;
      const assetId = await commands.importAsset(path, FOUR_MB);
      await commands.setAtlasBaseMap(assetId);
      onBaseMapChanged(assetId);
    } catch (err) {
      console.error('Failed to set base map:', err);
      const message =
        typeof err === 'string'
          ? err
          : 'Failed to set base map. The file may exceed the 4MB limit or be unsupported.';
      alert(message);
    }
  }

  async function handleRemoveBaseMap() {
    try {
      await commands.clearAtlasBaseMap();
      onBaseMapChanged(null);
    } catch (err) {
      console.error('Failed to remove base map:', err);
    }
  }

  const paintActive = atlasTool === 'brush' || atlasTool === 'erase';

  return (
    <div className="atlas-toolbar" data-no-pan>
      <div className="atlas-toolbar__group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`atlas-toolbar__tool ${atlasTool === t.id ? 'atlas-toolbar__tool--active' : ''}`}
            onClick={() => setAtlasTool(t.id)}
            title={t.label}
            disabled={pendingPlacement && t.id !== 'select'}
          >
            <span className="atlas-toolbar__icon">{t.icon}</span>
            <span className="atlas-toolbar__label">{t.label}</span>
          </button>
        ))}
      </div>

      {paintActive && (
        <div className="atlas-toolbar__group atlas-toolbar__paint">
          <div className="atlas-toolbar__swatches">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                className={`atlas-toolbar__swatch ${atlasBrushColor === c ? 'atlas-toolbar__swatch--active' : ''}`}
                style={{ background: c }}
                onClick={() => setAtlasBrushColor(c)}
                title={c}
                aria-label={`Color ${c}`}
              />
            ))}
            <input
              type="color"
              className="atlas-toolbar__color-picker"
              value={atlasBrushColor}
              onChange={(e) => setAtlasBrushColor(e.target.value)}
              title="Custom color"
            />
          </div>
          <label className="atlas-toolbar__size">
            Size
            <input
              type="range"
              min={10}
              max={400}
              step={5}
              value={atlasBrushSize}
              onChange={(e) => setAtlasBrushSize(Number(e.target.value))}
            />
            <span className="atlas-toolbar__size-value">{atlasBrushSize}</span>
          </label>
          <button className="btn btn--ghost btn--tiny" onClick={onClearPaint}>
            Clear paint
          </button>
        </div>
      )}

      <div className="atlas-toolbar__group atlas-toolbar__right">
        <div className="atlas-toolbar__basemap">
          {baseMapAssetId ? (
            <>
              <button className="btn btn--secondary btn--tiny" onClick={handlePickBaseMap}>
                Replace base map
              </button>
              <button className="btn btn--ghost btn--tiny" onClick={handleRemoveBaseMap}>
                Remove
              </button>
            </>
          ) : (
            <button className="btn btn--secondary btn--tiny" onClick={handlePickBaseMap}>
              Upload base map
            </button>
          )}
        </div>
        <button
          className="btn btn--primary"
          onClick={onAddEntity}
          disabled={pendingPlacement}
        >
          + Add entity
        </button>
      </div>
    </div>
  );
}
