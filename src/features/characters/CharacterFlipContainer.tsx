import { useCallback, useEffect, useState } from 'react';
import { commands } from '../../lib/commands';
import type { CharacterFull } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { CharacterCard } from './CharacterCard';
import { CharacterCinematic } from './CharacterCinematic';
import { CharacterDetails } from './CharacterDetails';
import './CharacterFlipContainer.css';

interface CharacterFlipContainerProps {
  characterId: string;
}

export function CharacterFlipContainer({ characterId }: CharacterFlipContainerProps) {
  const cardFlipped = useAppStore((s) => s.cardFlipped);
  const setCardFlipped = useAppStore((s) => s.setCardFlipped);
  const setSelectedCharacterId = useAppStore((s) => s.setSelectedCharacterId);
  // Ref callback pattern: setTabSlotEl re-renders CharacterDetails once the
  // slot div mounts, giving it a DOM target for its React portal.
  const [tabSlotEl, setTabSlotEl] = useState<HTMLDivElement | null>(null);
  // Local character fetch — we need the `cinematic_preview_locked` flag to
  // pick the front face and to drive the Lock button's active state.
  const [character, setCharacter] = useState<CharacterFull | null>(null);
  // Transient override: when true, show the non-default front view.
  // Resets whenever the selected character changes.
  const [previewToggle, setPreviewToggle] = useState(false);

  useEffect(() => {
    setPreviewToggle(false);
    commands.getCharacter(characterId).then(setCharacter).catch(console.error);
  }, [characterId]);

  const defaultCinematic = character?.cinematic_preview_locked ?? false;
  const effectiveCinematic = previewToggle ? !defaultCinematic : defaultCinematic;

  const handleToggleLock = useCallback(async () => {
    if (!character) return;
    const next = !character.cinematic_preview_locked;
    try {
      const updated = await commands.updateCharacter({
        characterId: character.id,
        cinematicPreviewLocked: next,
      });
      setCharacter(updated);
      // Reset preview so the newly-default view sticks.
      setPreviewToggle(false);
    } catch (e) {
      console.error('Failed to toggle cinematic lock:', e);
    }
  }, [character]);

  return (
    <div className="flip-outer">
      <div className="flip-toolbar" data-face={cardFlipped ? 'details' : 'card'}>
        <button
          className="btn btn--ghost flip-toolbar__back"
          onClick={() => setSelectedCharacterId(null)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to List
        </button>
        <div ref={setTabSlotEl} className="flip-toolbar__tab-slot" />
        <button
          className={`btn btn--secondary flip-toolbar__cine-preview ${previewToggle ? 'flip-toolbar__cine-preview--active' : ''}`}
          onClick={() => setPreviewToggle((p) => !p)}
          title={effectiveCinematic ? 'Showing cinematic — click to show normal' : 'Preview cinematic view'}
          disabled={!character}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Preview
        </button>
        <button
          className={`btn btn--secondary flip-toolbar__cine-lock ${defaultCinematic ? 'flip-toolbar__cine-lock--active' : ''}`}
          onClick={handleToggleLock}
          title={defaultCinematic ? 'Cinematic is the default — click to unlock' : 'Lock cinematic as default view'}
          disabled={!character}
        >
          {defaultCinematic ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 015.5-1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          )}
          {defaultCinematic ? 'Locked' : 'Lock'}
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
            {effectiveCinematic ? (
              <CharacterCinematic characterId={characterId} />
            ) : (
              <CharacterCard characterId={characterId} />
            )}
          </div>
          <div className="flip-back">
            <CharacterDetails characterId={characterId} tabBarSlot={tabSlotEl} />
          </div>
        </div>
      </div>
    </div>
  );
}
