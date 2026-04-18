import { useEffect, useState, useCallback, useRef } from 'react';
import { commands } from '../../lib/commands';
import type { CharacterFull, CardBlock, BlockType } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { CardImage } from '../../components/characters/CardImage';
import { CardHeader } from '../../components/characters/CardHeader';
import { CardGrid } from '../../components/characters/CardGrid';
import { CardBlockDock } from '../../components/characters/CardBlockDock';
import { LinkedRecords } from '../../components/characters/LinkedRecords';
import './CharacterCard.css';

interface CharacterCardProps {
  characterId: string;
}

export function CharacterCard({ characterId }: CharacterCardProps) {
  const [character, setCharacter] = useState<CharacterFull | null>(null);
  const [blocks, setBlocks] = useState<CardBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const editMode = useAppStore((s) => s.editMode);
  // Shared between CardBlockDock (writes on dragstart) and CardGrid (reads
  // during dragover) so the placement preview shows the preset's true size
  // and label.
  const presetDragRef = useRef<{ cols: number; rows: number; title: string; blockType: BlockType } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [char, blks] = await Promise.all([
        commands.getCharacter(characterId),
        commands.listCardBlocks(characterId),
      ]);
      setCharacter(char);
      setBlocks(blks);
    } catch (e) {
      setError(String(e));
    }
  }, [characterId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCharacterUpdate = useCallback(async (updates: Parameters<typeof commands.updateCharacter>[0]) => {
    try {
      const updated = await commands.updateCharacter(updates);
      setCharacter(updated);
    } catch (e) {
      console.error('Failed to update character:', e);
    }
  }, []);

  const refreshBlocks = useCallback(async () => {
    try {
      const blks = await commands.listCardBlocks(characterId);
      setBlocks(blks);
    } catch (e) {
      console.error('Failed to refresh blocks:', e);
    }
  }, [characterId]);

  if (error) {
    return <div className="character-card__error">Failed to load character: {error}</div>;
  }

  if (!character) {
    return <div className="character-card__loading">Loading...</div>;
  }

  return (
    <div className={`character-card ${editMode ? 'character-card--editing' : ''}`}>
      <div className="character-card__body">
        <div className="character-card__image-col">
          <CardImage character={character} onUpdate={handleCharacterUpdate} editMode={editMode} />
        </div>
        <div className="character-card__content-col">
          <CardHeader character={character} onUpdate={handleCharacterUpdate} editMode={editMode} />
          <CardGrid
            blocks={blocks}
            characterId={characterId}
            editMode={editMode}
            onRefresh={refreshBlocks}
            presetDragRef={presetDragRef}
          />
          <LinkedRecords characterId={characterId} />
        </div>
      </div>
      {editMode && (
        <CardBlockDock
          characterId={characterId}
          blocks={blocks}
          onRefresh={refreshBlocks}
          presetDragRef={presetDragRef}
        />
      )}
    </div>
  );
}
