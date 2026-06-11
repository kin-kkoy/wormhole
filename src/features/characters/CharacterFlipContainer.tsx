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
  const editMode = useAppStore((s) => s.editMode);
  const setEditMode = useAppStore((s) => s.setEditMode);
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
      {/* ── Compact icon bar ─── */}
      <div className="flip-toolbar" data-face={cardFlipped ? 'details' : 'card'}>
        <button
          className="flip-toolbar__back"
          onClick={() => setSelectedCharacterId(null)}
          title="Back to character list"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <span className="flip-toolbar__char-name">{character?.name ?? ''}</span>
        {character?.short_role && (
          <>
            <span className="flip-toolbar__char-sep">·</span>
            <span className="flip-toolbar__char-role">{character.short_role}</span>
          </>
        )}

        <div className="flip-toolbar__pill">
          <button
            className={`flip-toolbar__pill-seg ${!cardFlipped ? 'flip-toolbar__pill-seg--active' : ''}`}
            onClick={() => setCardFlipped(false)}
          >
            Card
          </button>
          <button
            className={`flip-toolbar__pill-seg ${cardFlipped ? 'flip-toolbar__pill-seg--active' : ''}`}
            onClick={() => setCardFlipped(true)}
          >
            Details
          </button>
        </div>

        <div className="flip-toolbar__sep" />

        <button
          className={`flip-toolbar__icon-btn ${previewToggle && !isLocked ? 'flip-toolbar__icon-btn--active' : ''}`}
          onClick={() => setPreviewToggle((p) => !p)}
          title={
            isLocked
              ? 'Showcase is disabled while the view is locked'
              : previewToggle
                ? 'Showing showcase — click to return to card'
                : 'Showcase'
          }
          disabled={!character || isLocked}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5S1 8 1 8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>

        <button
          className={`flip-toolbar__icon-btn ${isLocked ? 'flip-toolbar__icon-btn--active' : ''}`}
          onClick={handleToggleLock}
          title={
            isLocked
              ? `Locked to ${lockedFace} view — click to unlock`
              : `Lock the current ${effectiveCinematic ? 'showcase' : 'card'} view as default`
          }
          disabled={!character}
        >
          {isLocked ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 7V5a3 3 0 015.5-1.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          )}
        </button>

        <button
          className={`flip-toolbar__icon-btn ${editMode ? 'flip-toolbar__icon-btn--active' : ''}`}
          onClick={() => setEditMode(!editMode)}
          title={editMode ? 'Exit edit mode' : 'Edit'}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Tab row (visible on details face, hidden on card via CSS) ─── */}
      <div className="flip-toolbar__tab-row" data-face={cardFlipped ? 'details' : 'card'}>
        <div ref={setTabSlotEl} className="flip-toolbar__tab-slot" />
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
