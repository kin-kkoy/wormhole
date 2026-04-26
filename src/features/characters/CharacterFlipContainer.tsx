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
  // Local character fetch — we need `locked_face` to drive the front face and
  // the lock/preview buttons' state.
  const [character, setCharacter] = useState<CharacterFull | null>(null);
  // Transient override only meaningful while unlocked: when true, show
  // cinematic instead of card. Resets on character change or any lock change.
  const [previewToggle, setPreviewToggle] = useState(false);

  useEffect(() => {
    setPreviewToggle(false);
    commands.getCharacter(characterId).then(setCharacter).catch(console.error);
  }, [characterId]);

  const lockedFace = character?.locked_face ?? null;
  const isLocked = lockedFace !== null;
  const effectiveCinematic = isLocked ? lockedFace === 'cinematic' : previewToggle;

  const handleToggleLock = useCallback(async () => {
    if (!character) return;
    // Locked → unlock (clear). Unlocked → lock to whichever face is currently
    // visible. previewToggle resets either way.
    const nextFace: 'card' | 'cinematic' | null = isLocked
      ? null
      : effectiveCinematic
        ? 'cinematic'
        : 'card';
    try {
      const updated = await commands.updateCharacter({
        characterId: character.id,
        lockedFace: nextFace,
      });
      setCharacter(updated);
      setPreviewToggle(false);
    } catch (e) {
      console.error('Failed to toggle character lock:', e);
    }
  }, [character, isLocked, effectiveCinematic]);

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
          className={`btn btn--secondary flip-toolbar__cine-preview ${previewToggle && !isLocked ? 'flip-toolbar__cine-preview--active' : ''}`}
          onClick={() => setPreviewToggle((p) => !p)}
          title={
            isLocked
              ? 'Preview is disabled while the view is locked — unlock to switch faces'
              : previewToggle
                ? 'Showing cinematic preview — click to return to card'
                : 'Preview cinematic view'
          }
          disabled={!character || isLocked}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
          Preview
        </button>
        <button
          className={`btn btn--secondary flip-toolbar__cine-lock ${isLocked ? 'flip-toolbar__cine-lock--active' : ''}`}
          onClick={handleToggleLock}
          title={
            isLocked
              ? `Locked to ${lockedFace} view — click to unlock`
              : `Click to lock the current ${effectiveCinematic ? 'cinematic' : 'card'} view as the default`
          }
          disabled={!character}
        >
          {isLocked ? (
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
          {isLocked ? 'Locked' : 'Lock'}
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
