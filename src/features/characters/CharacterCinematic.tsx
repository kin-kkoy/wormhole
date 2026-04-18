import { useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import type { CharacterFull } from '../../lib/commands';
import { useImageCache } from '../../hooks/useImageCache';
import './CharacterCinematic.css';

interface CharacterCinematicProps {
  characterId: string;
}

export function CharacterCinematic({ characterId }: CharacterCinematicProps) {
  const [character, setCharacter] = useState<CharacterFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { getImageUrl, loadImages } = useImageCache();

  useEffect(() => {
    commands
      .getCharacter(characterId)
      .then(setCharacter)
      .catch((e) => setError(String(e)));
  }, [characterId]);

  useEffect(() => {
    if (!character?.image_asset_id) return;
    loadImages([character.image_asset_id]);
  }, [character?.image_asset_id, loadImages]);

  if (error) {
    return <div className="character-cinematic__error">Failed to load: {error}</div>;
  }
  if (!character) {
    return <div className="character-cinematic__loading">Loading…</div>;
  }

  const imageUrl = character.image_asset_id ? getImageUrl(character.image_asset_id) : null;

  return (
    <div className="character-cinematic">
      <div className="character-cinematic__image-wrap">
        {imageUrl ? (
          <img
            className="character-cinematic__image"
            src={imageUrl}
            alt={character.name}
            draggable={false}
          />
        ) : (
          <div className="character-cinematic__placeholder">
            <span className="character-cinematic__placeholder-glyph">&#9823;</span>
          </div>
        )}
        <div className="character-cinematic__gradient" />
        <div className="character-cinematic__meta">
          <span className="character-cinematic__name">{character.name}</span>
          {character.short_role && (
            <span className="character-cinematic__role">{character.short_role}</span>
          )}
        </div>
      </div>
    </div>
  );
}
