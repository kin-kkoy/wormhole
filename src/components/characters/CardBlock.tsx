import { useCallback } from 'react';
import type { CardBlock as CardBlockType } from '../../lib/commands';
import { TipTapEditor } from '../editor/TipTapEditor';
import './CardBlock.css';

interface CardBlockProps {
  block: CardBlockType;
  editMode: boolean;
  selected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onResize: (blockId: string, dimension: 'col' | 'row') => void;
  onDelete: (blockId: string) => void;
  onContentUpdate: (blockId: string, content: string) => void;
  onDragStart?: (blockId: string) => void;
}

export function CardBlock({
  block,
  editMode,
  selected,
  onSelect,
  onResize,
  onDelete,
  onContentUpdate,
  onDragStart: onDragStartProp,
}: CardBlockProps) {
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/block-id', block.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartProp?.(block.id);
  }, [block.id, onDragStartProp]);

  const handleContentUpdate = useCallback((json: string) => {
    onContentUpdate(block.id, json);
  }, [block.id, onContentUpdate]);

  return (
    <div
      className={`card-block ${selected ? 'card-block--selected' : ''} ${editMode ? 'card-block--editable' : ''}`}
      style={{
        gridColumn: `${block.grid_column} / span ${block.col_span}`,
        gridRow: `${block.grid_row} / span ${block.row_span}`,
      }}
      onClick={editMode ? onSelect : undefined}
      draggable={editMode}
      onDragStart={editMode ? handleDragStart : undefined}
    >
      <div className="card-block__header">
        <span className="card-block__title">{block.title}</span>
        {editMode && selected && (
          <div className="card-block__controls">
            <button
              className="card-block__control-btn"
              onClick={(e) => { e.stopPropagation(); onResize(block.id, 'col'); }}
              title={`Width: ${block.col_span} → ${(block.col_span % 3) + 1}`}
            >
              W{block.col_span}
            </button>
            <button
              className="card-block__control-btn"
              onClick={(e) => { e.stopPropagation(); onResize(block.id, 'row'); }}
              title={`Height: ${block.row_span} → ${block.row_span === 1 ? 2 : 1}`}
            >
              H{block.row_span}
            </button>
            <button
              className="card-block__control-btn card-block__control-btn--danger"
              onClick={(e) => { e.stopPropagation(); onDelete(block.id); }}
              title="Delete block"
            >
              &times;
            </button>
          </div>
        )}
      </div>
      <div className="card-block__content">
        <TipTapEditor
          content={block.content}
          onUpdate={handleContentUpdate}
          editable={editMode}
          placeholder="Write content..."
        />
      </div>
    </div>
  );
}
