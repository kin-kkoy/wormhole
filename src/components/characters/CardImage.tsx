import { useCallback, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import type { CharacterFull } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { useImageCache } from '../../hooks/useImageCache';
import './CardImage.css';

interface CardImageProps {
  character: CharacterFull;
  onUpdate: (params: Parameters<typeof commands.updateCharacter>[0]) => void;
  editMode: boolean;
}

export function CardImage({ character, onUpdate, editMode }: CardImageProps) {
  const { getImageUrl, loadImages } = useImageCache();

  useEffect(() => {
    if (character.image_asset_id) {
      loadImages([character.image_asset_id]);
    }
  }, [character.image_asset_id, loadImages]);

  const imageUrl = character.image_asset_id ? getImageUrl(character.image_asset_id) : null;

  const handlePick = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (selected) {
      try {
        const assetId = await commands.importAsset(selected);
        // Prime the cache immediately so the re-render after onUpdate picks
        // up the fresh image without waiting for a second render-cycle to
        // discover `image_asset_id` changed.
        loadImages([assetId]);
        onUpdate({ characterId: character.id, imageAssetId: assetId });
      } catch (e) {
        console.error('Failed to import image:', e);
      }
    }
  }, [character.id, onUpdate, loadImages]);

  return (
    <div
      className={`card-image ${editMode ? 'card-image--editable' : ''}`}
      onClick={editMode ? handlePick : undefined}
      title={editMode ? 'Click to change image' : undefined}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={character.name} draggable={false} />
      ) : (
        <div className="card-image__placeholder">
          <span className="card-image__placeholder-icon">&#9823;</span>
          {editMode && <span className="card-image__placeholder-hint">Click to add image</span>}
        </div>
      )}
    </div>
  );
}
