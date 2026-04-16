import { useCallback } from 'react';
import type { CharacterFull } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { TipTapEditor } from '../editor/TipTapEditor';
import './CardInCharacterIntro.css';

interface CardInCharacterIntroProps {
  character: CharacterFull;
  onUpdate: (params: Parameters<typeof commands.updateCharacter>[0]) => void;
  editMode: boolean;
}

export function CardInCharacterIntro({ character, onUpdate, editMode }: CardInCharacterIntroProps) {
  const handleUpdate = useCallback((json: string) => {
    onUpdate({ characterId: character.id, inCharacterIntro: json });
  }, [character.id, onUpdate]);

  return (
    <div className="card-intro">
      <TipTapEditor
        content={character.in_character_intro || '{}'}
        onUpdate={handleUpdate}
        editable={editMode}
        placeholder="Write an in-character introduction..."
        className="card-intro__editor"
      />
    </div>
  );
}
