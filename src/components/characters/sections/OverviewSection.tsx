import { useCallback, useEffect } from 'react';
import type { DetailSection, CharacterFull } from '../../../lib/commands';
import { commands } from '../../../lib/commands';
import { useImageCache } from '../../../hooks/useImageCache';
import { TipTapEditor } from '../../editor/TipTapEditor';
import './OverviewSection.css';

interface OverviewSectionProps {
  section: DetailSection;
  character: CharacterFull;
  editMode: boolean;
  onUpdate: (sectionId: string, updates: { content?: string }) => void;
}

export function OverviewSection({ section, character, editMode, onUpdate }: OverviewSectionProps) {
  const { getImageUrl, loadImages } = useImageCache();

  useEffect(() => {
    if (character.image_asset_id) {
      loadImages([character.image_asset_id]);
    }
  }, [character.image_asset_id, loadImages]);

  const imageUrl = character.image_asset_id ? getImageUrl(character.image_asset_id) : null;
  const briefDetails: { key: string; value: string }[] = character.brief_details_json
    ? JSON.parse(character.brief_details_json)
    : [];

  const handleSummaryUpdate = useCallback((json: string) => {
    // Update the character's objective_summary, not the section content
    commands.updateCharacter({ characterId: character.id, objectiveSummary: json }).catch(console.error);
  }, [character.id]);

  const handleSectionContentUpdate = useCallback((json: string) => {
    onUpdate(section.id, { content: json });
  }, [section.id, onUpdate]);

  return (
    <div className="overview-section">
      <div className="overview-section__top">
        {imageUrl && (
          <div className="overview-section__image">
            <img src={imageUrl} alt={character.name} />
          </div>
        )}
        <div className="overview-section__info">
          <h2 className="overview-section__name">{character.name}</h2>
          {character.short_role && (
            <span className="overview-section__role">{character.short_role}</span>
          )}
          {briefDetails.length > 0 && (
            <div className="overview-section__details">
              {briefDetails.map((d, i) => (
                <div key={i} className="overview-section__detail-row">
                  <span className="overview-section__detail-key">{d.key}</span>
                  <span className="overview-section__detail-value">{d.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overview-section__summary">
        <h3 className="overview-section__summary-label">Objective Summary</h3>
        <TipTapEditor
          content={character.objective_summary || '{}'}
          onUpdate={handleSummaryUpdate}
          editable={editMode}
          placeholder="Write an objective summary of this character..."
        />
      </div>

      {section.content && (
        <div className="overview-section__extra">
          <TipTapEditor
            content={section.content}
            onUpdate={handleSectionContentUpdate}
            editable={editMode}
            placeholder="Additional overview notes..."
          />
        </div>
      )}
      {!section.content && editMode && (
        <div className="overview-section__extra">
          <TipTapEditor
            content="{}"
            onUpdate={handleSectionContentUpdate}
            editable={editMode}
            placeholder="Additional overview notes..."
          />
        </div>
      )}
    </div>
  );
}
