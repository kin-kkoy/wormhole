import { useState, useCallback, useEffect } from 'react';
import type { CharacterFull } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { RibbonColorPicker } from './RibbonColorPicker';
import { BriefDetailsEditor } from './BriefDetailsEditor';
import './CardHeader.css';

interface CardHeaderProps {
  character: CharacterFull;
  onUpdate: (params: Parameters<typeof commands.updateCharacter>[0]) => void;
  editMode: boolean;
}

export function CardHeader({ character, onUpdate, editMode }: CardHeaderProps) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(character.name);

  useEffect(() => {
    setNameValue(character.name);
  }, [character.name]);

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

  return (
    <div className="card-header">
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
  );
}
