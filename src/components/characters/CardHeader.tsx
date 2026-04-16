import { useState, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import type { CharacterFull } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { useImageCache } from '../../hooks/useImageCache';
import { RibbonColorPicker } from './RibbonColorPicker';
import { BriefDetailsEditor } from './BriefDetailsEditor';
import { useEffect } from 'react';
import './CardHeader.css';

interface CardHeaderProps {
  character: CharacterFull;
  onUpdate: (params: Parameters<typeof commands.updateCharacter>[0]) => void;
  editMode: boolean;
}

export function CardHeader({ character, onUpdate, editMode }: CardHeaderProps) {
  const { getImageUrl, loadImages } = useImageCache();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(character.name);

  useEffect(() => {
    setNameValue(character.name);
  }, [character.name]);

  useEffect(() => {
    if (character.image_asset_id) {
      loadImages([character.image_asset_id]);
    }
  }, [character.image_asset_id, loadImages]);

  const imageUrl = character.image_asset_id ? getImageUrl(character.image_asset_id) : null;

  const handleImagePick = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (selected) {
      try {
        const assetId = await commands.importAsset(selected);
        onUpdate({ characterId: character.id, imageAssetId: assetId });
      } catch (e) {
        console.error('Failed to import image:', e);
      }
    }
  }, [character.id, onUpdate]);

  const handleNameBlur = useCallback(() => {
    setEditingName(false);
    if (nameValue.trim() && nameValue.trim() !== character.name) {
      onUpdate({ characterId: character.id, name: nameValue.trim() });
    } else {
      setNameValue(character.name);
    }
  }, [nameValue, character.id, character.name, onUpdate]);

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setNameValue(character.name);
      setEditingName(false);
    }
  }, [character.name]);

  const briefDetails: { key: string; value: string }[] = character.brief_details_json
    ? JSON.parse(character.brief_details_json)
    : [];

  const isLandscape = character.card_layout_variant === 'landscape';

  return (
    <div className={`card-header card-header--${character.card_layout_variant}`}>
      {editMode && (
        <div className="card-header__variant-toggle">
          <button
            className={`card-header__variant-btn ${isLandscape ? 'card-header__variant-btn--active' : ''}`}
            onClick={() => onUpdate({ characterId: character.id, cardLayoutVariant: 'landscape' })}
          >
            Landscape
          </button>
          <button
            className={`card-header__variant-btn ${!isLandscape ? 'card-header__variant-btn--active' : ''}`}
            onClick={() => onUpdate({ characterId: character.id, cardLayoutVariant: 'portrait' })}
          >
            Portrait
          </button>
        </div>
      )}

      <div className="card-header__layout">
        <div
          className={`card-header__image ${editMode ? 'card-header__image--editable' : ''}`}
          onClick={editMode ? handleImagePick : undefined}
          title={editMode ? 'Click to change image' : undefined}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={character.name} draggable={false} />
          ) : (
            <div className="card-header__image-placeholder">
              <span>&#9823;</span>
              {editMode && <span className="card-header__image-hint">Click to add image</span>}
            </div>
          )}
        </div>

        <div className="card-header__info">
          {editingName && editMode ? (
            <input
              className="card-header__name-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              autoFocus
            />
          ) : (
            <h1
              className="card-header__name"
              onClick={editMode ? () => setEditingName(true) : undefined}
              title={editMode ? 'Click to edit name' : undefined}
            >
              {character.name}
            </h1>
          )}

          {character.decorative_ribbon && (
            <div
              className="card-header__ribbon"
              style={{ backgroundColor: character.decorative_ribbon }}
            />
          )}

          {editMode && (
            <RibbonColorPicker
              color={character.decorative_ribbon}
              onChange={(color) => onUpdate({ characterId: character.id, decorativeRibbon: color ?? '' })}
            />
          )}

          <BriefDetailsEditor
            details={briefDetails}
            editMode={editMode}
            onChange={(details) =>
              onUpdate({ characterId: character.id, briefDetailsJson: JSON.stringify(details) })
            }
          />
        </div>
      </div>
    </div>
  );
}
