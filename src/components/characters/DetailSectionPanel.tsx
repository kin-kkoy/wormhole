import { useState } from 'react';
import type { DetailSection, CharacterFull } from '../../lib/commands';
import { OverviewSection } from './sections/OverviewSection';
import { ProseSection } from './sections/ProseSection';
import { CardsSection } from './sections/CardsSection';
import { TimelineSection } from './sections/TimelineSection';
import { KeyValueSection } from './sections/KeyValueSection';
import { ConvertSectionDialog } from './ConvertSectionDialog';
import type { LayoutType } from '../../lib/section-conversion';
import './DetailSectionPanel.css';

interface DetailSectionPanelProps {
  section: DetailSection;
  character: CharacterFull;
  editMode: boolean;
  onUpdate: (sectionId: string, updates: {
    title?: string;
    layoutType?: string;
    content?: string;
    structuredContentJson?: string;
  }) => void;
}

export function DetailSectionPanel({ section, character, editMode, onUpdate }: DetailSectionPanelProps) {
  const [showConvert, setShowConvert] = useState(false);
  const isOverview = section.sort_order === 0 && section.title === 'Overview';

  // Overview always renders as its specialised form regardless of layout_type.
  const body = isOverview
    ? <OverviewSection section={section} character={character} editMode={editMode} onUpdate={onUpdate} />
    : section.layout_type === 'cards'
      ? <CardsSection section={section} editMode={editMode} onUpdate={onUpdate} />
      : section.layout_type === 'timeline'
        ? <TimelineSection section={section} editMode={editMode} onUpdate={onUpdate} />
        : section.layout_type === 'grid'
          ? <KeyValueSection section={section} editMode={editMode} onUpdate={onUpdate} />
          : <ProseSection section={section} editMode={editMode} onUpdate={onUpdate} />;

  const canConvert = editMode && !isOverview;

  return (
    <div className="detail-section-panel">
      {canConvert && (
        <div className="detail-section-panel__toolbar">
          <button
            type="button"
            className="detail-section-panel__convert-btn"
            onClick={() => setShowConvert(true)}
            title="Convert layout type"
          >
            <span className="detail-section-panel__convert-icon" aria-hidden="true">⇄</span>
            Convert layout
          </button>
        </div>
      )}

      <div className="detail-section-panel__body">
        {body}
      </div>

      {showConvert && (
        <ConvertSectionDialog
          section={section}
          onClose={() => setShowConvert(false)}
          onConvert={(to: LayoutType, result) => {
            const updates: {
              layoutType: string;
              content?: string;
              structuredContentJson?: string;
            } = { layoutType: to };
            if (result.content !== null) updates.content = result.content;
            if (result.structuredContentJson !== null) {
              updates.structuredContentJson = result.structuredContentJson;
            }
            onUpdate(section.id, updates);
            setShowConvert(false);
          }}
        />
      )}
    </div>
  );
}
