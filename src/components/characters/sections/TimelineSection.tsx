import { useState, useCallback, useMemo } from 'react';
import type { DetailSection } from '../../../lib/commands';
import { useEntryReorder } from './useEntryReorder';
import './TimelineSection.css';

interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  description: string;
}

interface TimelineSectionProps {
  section: DetailSection;
  editMode: boolean;
  onUpdate: (sectionId: string, updates: { structuredContentJson?: string }) => void;
}

export function TimelineSection({ section, editMode, onUpdate }: TimelineSectionProps) {
  const entries: TimelineEntry[] = useMemo(() => {
    if (!section.structured_content_json) return [];
    try {
      return JSON.parse(section.structured_content_json);
    } catch {
      return [];
    }
  }, [section.structured_content_json]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const saveEntries = useCallback((updated: TimelineEntry[]) => {
    onUpdate(section.id, { structuredContentJson: JSON.stringify(updated) });
  }, [section.id, onUpdate]);

  const reorder = useEntryReorder<TimelineEntry>(entries, saveEntries);

  const addEntry = useCallback(() => {
    const newEntry: TimelineEntry = {
      id: crypto.randomUUID(),
      date: '',
      title: 'New Event',
      description: '',
    };
    saveEntries([...entries, newEntry]);
    setEditingId(newEntry.id);
  }, [entries, saveEntries]);

  const updateEntry = useCallback((entryId: string, field: keyof TimelineEntry, value: string) => {
    const updated = entries.map((e) => e.id === entryId ? { ...e, [field]: value } : e);
    saveEntries(updated);
  }, [entries, saveEntries]);

  const removeEntry = useCallback((entryId: string) => {
    saveEntries(entries.filter((e) => e.id !== entryId));
  }, [entries, saveEntries]);

  return (
    <div className="timeline-section">
      <div className="timeline-section__line" />
      <div className="timeline-section__entries">
        {entries.map((entry, index) => {
          const isEditing = editMode && editingId === entry.id;
          return (
            <div
              key={entry.id}
              className={`timeline-section__entry ${
                reorder.isDropTarget(index) ? 'timeline-section__entry--drag-over' : ''
              } ${reorder.dragIndex === index ? 'timeline-section__entry--dragging' : ''}`}
              draggable={editMode && !isEditing}
              onDragStart={(e) => reorder.handleDragStart(e, index)}
              onDragOver={(e) => reorder.handleDragOver(e, index)}
              onDragLeave={() => reorder.handleDragLeave(index)}
              onDrop={(e) => reorder.handleDrop(e, index)}
              onDragEnd={reorder.handleDragEnd}
            >
              <div className="timeline-section__dot" />
              {isEditing ? (
                <div className="timeline-section__entry-edit">
                  <input
                    className="timeline-section__input timeline-section__input--date"
                    value={entry.date}
                    onChange={(e) => updateEntry(entry.id, 'date', e.target.value)}
                    placeholder="Date/Period (e.g. Year 1361)"
                  />
                  <input
                    className="timeline-section__input"
                    value={entry.title}
                    onChange={(e) => updateEntry(entry.id, 'title', e.target.value)}
                    placeholder="Event title"
                    autoFocus
                  />
                  <textarea
                    className="timeline-section__textarea"
                    value={entry.description}
                    onChange={(e) => updateEntry(entry.id, 'description', e.target.value)}
                    placeholder="Description..."
                    rows={2}
                  />
                  <div className="timeline-section__entry-actions">
                    <button className="btn btn--ghost" onClick={() => setEditingId(null)}>Done</button>
                    <button className="btn btn--ghost timeline-section__delete-btn" onClick={() => removeEntry(entry.id)}>Delete</button>
                  </div>
                </div>
              ) : (
                <div
                  className="timeline-section__entry-view"
                  onClick={editMode ? () => setEditingId(entry.id) : undefined}
                >
                  {editMode && (
                    <span
                      className="timeline-section__drag-handle"
                      aria-hidden="true"
                      title="Drag to reorder"
                    >
                      ⋮⋮
                    </span>
                  )}
                  {entry.date && <span className="timeline-section__date">{entry.date}</span>}
                  <h4 className="timeline-section__title">{entry.title}</h4>
                  {entry.description && <p className="timeline-section__desc">{entry.description}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {editMode && (
        <button className="timeline-section__add" onClick={addEntry}>
          + Add Entry
        </button>
      )}
    </div>
  );
}
