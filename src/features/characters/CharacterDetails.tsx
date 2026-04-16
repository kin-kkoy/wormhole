import { useEffect, useState, useCallback } from 'react';
import { commands } from '../../lib/commands';
import type { CharacterFull, DetailSection } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { DetailTabBar } from '../../components/characters/DetailTabBar';
import { DetailSectionPanel } from '../../components/characters/DetailSectionPanel';
import { SectionCreateDialog } from '../../components/characters/SectionCreateDialog';
import './CharacterDetails.css';

interface CharacterDetailsProps {
  characterId: string;
}

export function CharacterDetails({ characterId }: CharacterDetailsProps) {
  const [character, setCharacter] = useState<CharacterFull | null>(null);
  const [sections, setSections] = useState<DetailSection[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editMode = useAppStore((s) => s.editMode);

  const refresh = useCallback(async () => {
    try {
      const [char, secs] = await Promise.all([
        commands.getCharacter(characterId),
        commands.listDetailSections(characterId),
      ]);
      setCharacter(char);
      setSections(secs);
    } catch (e) {
      setError(String(e));
    }
  }, [characterId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Arrow key navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        setActiveIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'ArrowRight') {
        setActiveIndex((i) => Math.min(sections.length - 1, i + 1));
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [sections.length]);

  const handleSectionUpdate = useCallback(async (sectionId: string, updates: {
    title?: string;
    content?: string;
    structuredContentJson?: string;
  }) => {
    try {
      await commands.updateDetailSection({ sectionId, ...updates });
      await refresh();
    } catch (e) {
      console.error('Failed to update section:', e);
    }
  }, [refresh]);

  const handleRenameSection = useCallback(async (sectionId: string, newTitle: string) => {
    try {
      await commands.updateDetailSection({ sectionId, title: newTitle });
      await refresh();
    } catch (e) {
      console.error('Failed to rename section:', e);
    }
  }, [refresh]);

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    try {
      await commands.deleteDetailSection(sectionId);
      setActiveIndex((i) => Math.max(0, i - 1));
      await refresh();
    } catch (e) {
      console.error('Failed to delete section:', e);
    }
  }, [refresh]);

  const handleReorderSections = useCallback(async (sectionIds: string[]) => {
    try {
      await commands.reorderDetailSections(sectionIds);
      await refresh();
    } catch (e) {
      console.error('Failed to reorder sections:', e);
    }
  }, [refresh]);

  const handleCreateSection = useCallback(async (title: string, layoutType: string) => {
    try {
      await commands.createDetailSection({ characterId, title, layoutType });
      const [, newSections] = await Promise.all([
        commands.getCharacter(characterId).then(setCharacter),
        commands.listDetailSections(characterId),
      ]);
      setSections(newSections);
      // Navigate to the newly created section (last in the list)
      setActiveIndex(newSections.length - 1);
    } catch (e) {
      console.error('Failed to create section:', e);
    }
    setShowCreateDialog(false);
  }, [characterId]);

  if (error) {
    return <div className="character-details__error">Failed to load: {error}</div>;
  }

  if (!character) {
    return <div className="character-details__loading">Loading...</div>;
  }

  const activeSection = sections[activeIndex];

  return (
    <div className="character-details">
      <DetailTabBar
        sections={sections}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
        editMode={editMode}
        onDelete={handleDeleteSection}
        onRename={handleRenameSection}
        onReorder={handleReorderSections}
        onAdd={() => setShowCreateDialog(true)}
      />

      <div className="character-details__panel-container">
        <button
          className="character-details__nav-btn character-details__nav-btn--prev"
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
          title="Previous section"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="character-details__panel-viewport">
          {activeSection && (
            <DetailSectionPanel
              key={activeSection.id}
              section={activeSection}
              character={character}
              editMode={editMode}
              onUpdate={handleSectionUpdate}
            />
          )}
        </div>

        <button
          className="character-details__nav-btn character-details__nav-btn--next"
          onClick={() => setActiveIndex((i) => Math.min(sections.length - 1, i + 1))}
          disabled={activeIndex >= sections.length - 1}
          title="Next section"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Navigation dots */}
      {sections.length > 1 && (
        <div className="character-details__dots">
          {sections.map((_, i) => (
            <button
              key={i}
              className={`character-details__dot ${i === activeIndex ? 'character-details__dot--active' : ''}`}
              onClick={() => setActiveIndex(i)}
            />
          ))}
        </div>
      )}

      {showCreateDialog && (
        <SectionCreateDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={handleCreateSection}
        />
      )}
    </div>
  );
}
