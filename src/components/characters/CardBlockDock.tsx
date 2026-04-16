import { useState, useCallback } from 'react';
import type { CardBlock } from '../../lib/commands';
import './CardBlockDock.css';

const PRESET_BLOCKS = [
  'Relationships',
  'Personality',
  'Arc Notes',
  'Powers',
  'Secrets',
  'Backstory',
  'Quotes',
  'Inventory',
  'Goals',
  'Fears',
];

interface CardBlockDockProps {
  characterId: string;
  blocks: CardBlock[];
  onRefresh: () => void;
}

export function CardBlockDock({ blocks, onRefresh: _onRefresh }: CardBlockDockProps) {
  const [customTitle, setCustomTitle] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Check which block types are already placed
  const placedTitles = new Set(blocks.map((b) => b.title));

  const handleDragStart = useCallback((e: React.DragEvent, title: string) => {
    e.dataTransfer.setData('text/block-title', title);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleAddCustom = useCallback(() => {
    if (!customTitle.trim()) return;
    // The custom block is made draggable with this title
    setShowCustomInput(false);
  }, [customTitle]);

  return (
    <div className="card-block-dock">
      <div className="card-block-dock__header">
        <h3 className="card-block-dock__title">Block Palette</h3>
        <span className="card-block-dock__hint">Drag blocks onto the grid</span>
      </div>

      <div className="card-block-dock__section">
        <div className="card-block-dock__list">
          {PRESET_BLOCKS.map((title) => {
            const placed = placedTitles.has(title);
            return (
              <div
                key={title}
                className={`card-block-dock__item ${placed ? 'card-block-dock__item--placed' : ''}`}
                draggable={!placed}
                onDragStart={(e) => handleDragStart(e, title)}
              >
                <span className="card-block-dock__item-icon">&#9632;</span>
                <span className="card-block-dock__item-label">{title}</span>
                {placed && <span className="card-block-dock__item-badge">placed</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-block-dock__section card-block-dock__custom-section">
        {showCustomInput ? (
          <div className="card-block-dock__custom-input-row">
            <input
              className="card-block-dock__custom-input"
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustom();
                if (e.key === 'Escape') { setShowCustomInput(false); setCustomTitle(''); }
              }}
              placeholder="Block title..."
              autoFocus
            />
          </div>
        ) : null}
        {showCustomInput && customTitle.trim() ? (
          <div
            className="card-block-dock__item card-block-dock__item--custom"
            draggable
            onDragStart={(e) => handleDragStart(e, customTitle.trim())}
          >
            <span className="card-block-dock__item-icon">&#9830;</span>
            <span className="card-block-dock__item-label">{customTitle.trim()}</span>
            <span className="card-block-dock__item-badge">drag me</span>
          </div>
        ) : null}
        <button
          className="card-block-dock__add-custom"
          onClick={() => { setShowCustomInput(!showCustomInput); setCustomTitle(''); }}
        >
          {showCustomInput ? 'Cancel' : '+ Custom Block'}
        </button>
      </div>
    </div>
  );
}
