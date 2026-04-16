import { useAppStore } from '../../state/store';
import { CharacterList } from './CharacterList';
import { CharacterFlipContainer } from './CharacterFlipContainer';
import './CharacterCodex.css';

export function CharacterCodex() {
  const selectedCharacterId = useAppStore((s) => s.selectedCharacterId);

  return (
    <div className="character-codex">
      {selectedCharacterId ? (
        <CharacterFlipContainer characterId={selectedCharacterId} />
      ) : (
        <CharacterList />
      )}
    </div>
  );
}
