import { useEffect, useState, useCallback } from 'react';
import { commands } from '../../lib/commands';
import type { CharacterFull, CardBlock } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { CardHeader } from '../../components/characters/CardHeader';
import { CardInCharacterIntro } from '../../components/characters/CardInCharacterIntro';
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
        <CardHeader character={character} onUpdate={handleCharacterUpdate} editMode={editMode} />
        <CardInCharacterIntro character={character} onUpdate={handleCharacterUpdate} editMode={editMode} />
        <CardGrid blocks={blocks} characterId={characterId} editMode={editMode} onRefresh={refreshBlocks} />
        <LinkedRecords characterId={characterId} />
      </div>
      {editMode && (
        <CardBlockDock characterId={characterId} blocks={blocks} onRefresh={refreshBlocks} />
      )}
    </div>
  );
}
