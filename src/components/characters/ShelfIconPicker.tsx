import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { commands } from '../../lib/commands';
import { useImageCache } from '../../hooks/useImageCache';
import './RibbonIconPicker.css';

interface ShelfIconPickerProps {
  shelfId: string;
  assetId: string | null;
  onUpdated: () => void;
}

export function ShelfIconPicker({ shelfId, assetId, onUpdated }: ShelfIconPickerProps) {
  const { getImageUrl, loadImages } = useImageCache();

  const iconUrl = assetId ? getImageUrl(assetId) : null;

  const handlePick = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'] }],
    });
    if (selected) {
      try {
        const newAssetId = await commands.importAsset(selected);
        loadImages([newAssetId]);
        await commands.updateShelfIcon(shelfId, newAssetId);
        onUpdated();
      } catch (e) {
        console.error('Failed to import shelf icon:', e);
      }
    }
  }, [shelfId, onUpdated, loadImages]);

  const handleRemove = useCallback(async () => {
    await commands.updateShelfIcon(shelfId, null);
    onUpdated();
  }, [shelfId, onUpdated]);

  return (
    <div className="ribbon-icon-picker">
      <span className="ribbon-icon-picker__label">Shelf Icon</span>
      <div className="ribbon-icon-picker__actions">
        {iconUrl && (
          <img className="ribbon-icon-picker__preview" src={iconUrl} alt="Shelf icon" draggable={false} />
        )}
        <button className="ribbon-icon-picker__btn" onClick={handlePick} type="button">
          {assetId ? 'Change' : 'Add'}
        </button>
        {assetId && (
          <button className="ribbon-icon-picker__btn ribbon-icon-picker__btn--remove" onClick={handleRemove} type="button">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
