import type { DetailSection, CharacterFull } from '../../lib/commands';
import { OverviewSection } from './sections/OverviewSection';
import { ProseSection } from './sections/ProseSection';
import { CardsSection } from './sections/CardsSection';
import { TimelineSection } from './sections/TimelineSection';
import { KeyValueSection } from './sections/KeyValueSection';

interface DetailSectionPanelProps {
  section: DetailSection;
  character: CharacterFull;
  editMode: boolean;
  onUpdate: (sectionId: string, updates: {
    title?: string;
    content?: string;
    structuredContentJson?: string;
  }) => void;
}

export function DetailSectionPanel({ section, character, editMode, onUpdate }: DetailSectionPanelProps) {
  // Overview section is always first (sort_order 0)
  if (section.sort_order === 0 && section.title === 'Overview') {
    return (
      <OverviewSection
        section={section}
        character={character}
        editMode={editMode}
        onUpdate={onUpdate}
      />
    );
  }

  switch (section.layout_type) {
    case 'prose':
      return <ProseSection section={section} editMode={editMode} onUpdate={onUpdate} />;
    case 'cards':
      return <CardsSection section={section} editMode={editMode} onUpdate={onUpdate} />;
    case 'timeline':
      return <TimelineSection section={section} editMode={editMode} onUpdate={onUpdate} />;
    case 'grid':
      return <KeyValueSection section={section} editMode={editMode} onUpdate={onUpdate} />;
    default:
      return <ProseSection section={section} editMode={editMode} onUpdate={onUpdate} />;
  }
}
