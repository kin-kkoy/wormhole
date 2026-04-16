import { useAppStore } from '../../state/store';
import { CharacterCard } from './CharacterCard';
import { CharacterDetails } from './CharacterDetails';
import './CharacterFlipContainer.css';

interface CharacterFlipContainerProps {
  characterId: string;
}

export function CharacterFlipContainer({ characterId }: CharacterFlipContainerProps) {
  const cardFlipped = useAppStore((s) => s.cardFlipped);
  const setCardFlipped = useAppStore((s) => s.setCardFlipped);
  const setSelectedCharacterId = useAppStore((s) => s.setSelectedCharacterId);

  return (
    <div className="flip-outer">
      <div className="flip-toolbar">
        <button
          className="btn btn--ghost flip-toolbar__back"
          onClick={() => setSelectedCharacterId(null)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to List
        </button>
        <button
          className={`btn btn--secondary flip-toolbar__toggle ${cardFlipped ? 'flip-toolbar__toggle--flipped' : ''}`}
          onClick={() => setCardFlipped(!cardFlipped)}
          title={cardFlipped ? 'Show Card Front' : 'Show Details'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 1h8a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V3a2 2 0 012-2z" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 1v14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2"/>
          </svg>
          {cardFlipped ? 'Card' : 'Details'}
        </button>
      </div>
      <div className="flip-container" data-flipped={cardFlipped}>
        <div className="flip-inner">
          <div className="flip-front">
            <CharacterCard characterId={characterId} />
          </div>
          <div className="flip-back">
            <CharacterDetails characterId={characterId} />
          </div>
        </div>
      </div>
    </div>
  );
}
