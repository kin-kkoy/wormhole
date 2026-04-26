import { useCallback, useMemo } from 'react';
import type { DetailSection } from '../../../lib/commands';
import { TipTapEditor } from '../../editor/TipTapEditor';
import './ProseSection.css';

interface ProseSectionProps {
  section: DetailSection;
  editMode: boolean;
  onUpdate: (sectionId: string, updates: { content?: string }) => void;
}

export function ProseSection({ section, editMode, onUpdate }: ProseSectionProps) {
  const handleUpdate = useCallback((json: string) => {
    onUpdate(section.id, { content: json });
  }, [section.id, onUpdate]);

  // Estimate character count for two-column determination
  const isLong = useMemo(() => {
    if (!section.content) return false;
    try {
      const parsed = JSON.parse(section.content);
      const text = extractText(parsed);
      return text.length > 500;
    } catch {
      return false;
    }
  }, [section.content]);

  return (
    <div className={`prose-section ${!editMode && isLong ? 'prose-section--two-col' : ''}`}>
      <TipTapEditor
        content={section.content || '{}'}
        onUpdate={handleUpdate}
        editable={editMode}
        placeholder="Write your content here..."
        linkSource={{ type: 'character', id: section.character_id }}
      />
    </div>
  );
}

function extractText(node: Record<string, unknown>): string {
  if (node.text && typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return node.content.map((child: Record<string, unknown>) => extractText(child)).join('');
  }
  return '';
}
