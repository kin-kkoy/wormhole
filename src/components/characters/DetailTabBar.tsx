import { useState, useCallback } from 'react';
import type { DetailSection } from '../../lib/commands';
import './DetailTabBar.css';

interface DetailTabBarProps {
  sections: DetailSection[];
  activeIndex: number;
  onSelect: (index: number) => void;
  editMode: boolean;
  onDelete: (sectionId: string) => void;
  onRename: (sectionId: string, newTitle: string) => void;
  onReorder: (sectionIds: string[]) => void;
  onAdd: () => void;
}

export function DetailTabBar({
  sections,
  activeIndex,
  onSelect,
  editMode,
  onDelete,
  onRename,
  onReorder,
  onAdd,
}: DetailTabBarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (index === 0) {
      e.preventDefault();
      return;
    }
    // Some browsers require dataTransfer payload for drop events to fire.
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (index === 0) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex || dropIndex === 0) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...sections];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    setDragIndex(null);
    setDragOverIndex(null);
    onReorder(reordered.map((s) => s.id));
  }, [dragIndex, sections, onReorder]);

  function startRename(section: DetailSection) {
    setRenamingId(section.id);
    setRenameValue(section.title);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  }

  return (
    <div className="detail-tab-bar">
      <div className="detail-tab-bar__tabs">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={`detail-tab-bar__tab ${index === activeIndex ? 'detail-tab-bar__tab--active' : ''} ${dragOverIndex === index ? 'detail-tab-bar__tab--drag-over' : ''}`}
            onClick={() => onSelect(index)}
            draggable={editMode && index > 0 && renamingId !== section.id}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={() => { if (dragOverIndex === index) setDragOverIndex(null); }}
            onDrop={(e) => { e.preventDefault(); handleDrop(index); }}
            onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
          >
            {renamingId === section.id ? (
              <input
                className="detail-tab-bar__rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setRenamingId(null); setRenameValue(''); }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span
                className="detail-tab-bar__tab-label"
                onDoubleClick={editMode && index > 0 ? (e) => { e.stopPropagation(); startRename(section); } : undefined}
                title={editMode && index > 0 ? 'Double-click to rename' : undefined}
              >
                {section.title}
              </span>
            )}
            {editMode && index > 0 && renamingId !== section.id && (
              <button
                className="detail-tab-bar__tab-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(section.id);
                }}
                title="Delete section"
              >
                &times;
              </button>
            )}
          </div>
        ))}
        {editMode && (
          <button className="detail-tab-bar__add" onClick={onAdd} title="Add section">
            +
          </button>
        )}
      </div>
    </div>
  );
}
