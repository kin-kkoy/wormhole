import { useState, useCallback } from 'react';
import type { CardBlock, BlockType } from '../../lib/commands';
import './CardBlockDock.css';

interface PresetBlock {
  /** Display name shown in the palette row and the drag ghost. */
  label: string;
  /** Title written to the created block. Empty = content-only block (text
   *  type has no title at all). */
  title: string;
  cols: number;
  rows: number;
  /** Render / behavior kind. Default 'standard' = title + content. */
  blockType?: BlockType;
  /** Multi-instance presets skip the "placed" uniqueness check. */
  multi?: boolean;
}

// Label and Text are type-locked generic blocks that sit at the top of the
// palette:
//   - Label: title-only strip, height locked to 1 row. No content area at all.
//   - Text: content-only block for prose / bullets. Never has a title.
// Everything else is a 'standard' preset (title + content) and can be placed
// once per character (they're genre-specific roles).
const PRESET_BLOCKS: PresetBlock[] = [
  { label: 'Label',        title: 'Label', cols: 3, rows: 1, blockType: 'label', multi: true },
  { label: 'Text',         title: '',      cols: 2, rows: 2, blockType: 'text',  multi: true },
  { label: 'Backstory',    title: 'Backstory',    cols: 2, rows: 2 },
  { label: 'Relationships',title: 'Relationships',cols: 2, rows: 2 },
  { label: 'Arc Notes',    title: 'Arc Notes',    cols: 2, rows: 2 },
  { label: 'Quotes',       title: 'Quotes',       cols: 3, rows: 2 },
  { label: 'Personality',  title: 'Personality',  cols: 1, rows: 2 },
  { label: 'Powers',       title: 'Powers',       cols: 1, rows: 2 },
  { label: 'Inventory',    title: 'Inventory',    cols: 1, rows: 2 },
  { label: 'Goals',        title: 'Goals',        cols: 1, rows: 1 },
  { label: 'Fears',        title: 'Fears',        cols: 1, rows: 1 },
  { label: 'Secrets',      title: 'Secrets',      cols: 1, rows: 1 },
];

export interface PresetDragRef {
  current: { cols: number; rows: number; title: string; blockType: BlockType } | null;
}

interface CardBlockDockProps {
  characterId: string;
  blocks: CardBlock[];
  onRefresh: () => void;
  presetDragRef: PresetDragRef;
}

export function CardBlockDock({ blocks, presetDragRef }: CardBlockDockProps) {
  const [customTitle, setCustomTitle] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const placedTitles = new Set(blocks.map((b) => b.title).filter(Boolean));

  const handleDragStart = useCallback(
    (
      e: React.DragEvent,
      title: string,
      cols: number,
      rows: number,
      label: string,
      blockType: BlockType,
      presetUnique: boolean,
    ) => {
      e.dataTransfer.setData('text/block-title', title);
      e.dataTransfer.setData('text/block-cols', String(cols));
      e.dataTransfer.setData('text/block-rows', String(rows));
      e.dataTransfer.setData('text/block-type', blockType);
      e.dataTransfer.setData('text/block-unique', presetUnique ? '1' : '0');
      e.dataTransfer.effectAllowed = 'copy';
      // Mirror cols/rows/title/type into the shared ref so CardGrid's dragover
      // preview can size + label the ghost (dataTransfer values aren't
      // readable in dragover events, only the type list is). Use the palette
      // label for the preview so content-only presets (empty title) still
      // read as something during drag.
      presetDragRef.current = { cols, rows, title: label, blockType };

      // Build a block-shaped drag image so the floating cursor ghost looks
      // like the real block, not the tiny palette row. We attach it off-screen,
      // let the browser snapshot it for the drag preview, then remove it on
      // the next tick.
      const ghost = document.createElement('div');
      ghost.className = 'card-block-preset-ghost';
      const header = document.createElement('div');
      header.className = 'card-block-preset-ghost__header';
      header.textContent = label;
      const body = document.createElement('div');
      body.className = 'card-block-preset-ghost__body';
      ghost.appendChild(header);
      ghost.appendChild(body);
      // Approximate block dimensions — grid is responsive so we can't match
      // exactly, but this is close enough to read as a block.
      ghost.style.width = `${cols * 180}px`;
      ghost.style.height = `${rows * 120}px`;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 20, 20);
      setTimeout(() => ghost.remove(), 0);
    },
    [presetDragRef],
  );

  const handleDragEnd = useCallback(() => {
    presetDragRef.current = null;
  }, [presetDragRef]);

  const handleAddCustom = useCallback(() => {
    if (!customTitle.trim()) return;
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
          {PRESET_BLOCKS.map((preset) => {
            // Multi-instance presets (Label, Text) are always draggable.
            const placed = !preset.multi && preset.title !== '' && placedTitles.has(preset.title);
            return (
              <div
                key={preset.label}
                className={`card-block-dock__item ${placed ? 'card-block-dock__item--placed' : ''}`}
                draggable={!placed}
                onDragStart={(e) => handleDragStart(e, preset.title, preset.cols, preset.rows, preset.label, preset.blockType ?? 'standard', !preset.multi)}
                onDragEnd={handleDragEnd}
              >
                <span className="card-block-dock__item-icon">&#9632;</span>
                <span className="card-block-dock__item-label">{preset.label}</span>
                <span className="card-block-dock__item-size">
                  {preset.cols}&times;{preset.rows}
                </span>
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
            onDragStart={(e) => handleDragStart(e, customTitle.trim(), 1, 1, customTitle.trim(), 'standard', false)}
            onDragEnd={handleDragEnd}
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
