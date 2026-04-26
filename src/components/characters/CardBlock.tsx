import { useCallback, useEffect, useState } from 'react';
import type { CardBlock as CardBlockType } from '../../lib/commands';
import { TipTapEditor } from '../editor/TipTapEditor';
import './CardBlock.css';

interface CardBlockProps {
  block: CardBlockType;
  editMode: boolean;
  selected: boolean;
  /** True when another block occupies cells in this block's column range
   *  strictly below it — used to decide whether view-mode content can overflow
   *  into the cells beneath rather than scroll internally. */
  hasBlockBelow?: boolean;
  /** True while the user is actively drag-resizing this block — fades the
   *  real block so the resize ghost reads as the canonical footprint. */
  isResizing?: boolean;
  /** True while the user is actively rearranging (hamburger-drag). Same
   *  idea as isResizing: fade the block so the ghost reads as canonical. */
  isRearranging?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  /** Fired on mousedown on a resize handle; the parent grid then tracks
   *  mouse moves at the window level and commits via reflow on mouseup. */
  onResizeStart: (
    blockId: string,
    direction: 'right' | 'bottom' | 'corner' | 'left' | 'top',
    clientX: number,
    clientY: number,
  ) => void;
  /** Fired on mousedown on the hamburger handle. The grid tracks window
   *  mousemove/mouseup to compute the drop cell and commit via reflow.
   *  We avoid the HTML5 drag API because wry's WebKitGTK backend silently
   *  drops dragstart events in several configurations — text-selection
   *  takes over instead and nothing works. */
  onRearrangeStart: (blockId: string, clientX: number, clientY: number) => void;
  onDelete: (blockId: string) => void;
  onContentUpdate: (blockId: string, content: string) => void;
  onTitleUpdate: (blockId: string, title: string) => void;
}

export function CardBlock({
  block,
  editMode,
  selected,
  hasBlockBelow = false,
  isResizing = false,
  isRearranging = false,
  onSelect,
  onResizeStart,
  onRearrangeStart,
  onDelete,
  onContentUpdate,
  onTitleUpdate,
}: CardBlockProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(block.title);

  useEffect(() => {
    setTitleValue(block.title);
  }, [block.title]);

  const handleContentUpdate = useCallback((json: string) => {
    onContentUpdate(block.id, json);
  }, [block.id, onContentUpdate]);

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    const next = titleValue.trim();
    if (next !== block.title) {
      onTitleUpdate(block.id, next);
    }
  }, [block.id, block.title, titleValue, onTitleUpdate]);

  const cancelTitleEdit = useCallback(() => {
    setTitleValue(block.title);
    setEditingTitle(false);
  }, [block.title]);

  const blockType = block.block_type ?? 'standard';
  const isLabel = blockType === 'label';
  const isText = blockType === 'text';
  const hasTitle = block.title.length > 0;

  // Header visibility rules differ by type:
  //   - label: header IS the block — always shown
  //   - text:  never has a title; header renders only in edit mode so you can
  //            still drag the block and access controls
  //   - standard: edit mode always shows header; view mode shows it only if
  //               there's a title to display
  const showHeader = isLabel ? true : (isText ? editMode : (editMode || hasTitle));
  // Label blocks have no content area at all — they're pure title strips.
  const showContent = !isLabel;
  // Text blocks never display or edit a title, even in edit mode.
  const showTitleEl = !isText;

  const canOverflow = !editMode && !hasBlockBelow && showContent;
  // Labels are height-locked — only horizontal resize handles are offered.
  const allowVerticalResize = !isLabel;

  const handleResizeMouseDown = (direction: 'right' | 'bottom' | 'corner' | 'left' | 'top') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onResizeStart(block.id, direction, e.clientX, e.clientY);
  };

  const handleHamburgerMouseDown = (e: React.MouseEvent) => {
    // preventDefault here stops WebKit from taking this mousedown as the
    // start of a native text selection gesture — which is exactly what the
    // user was seeing when HTML5 drag silently failed.
    e.preventDefault();
    e.stopPropagation();
    onRearrangeStart(block.id, e.clientX, e.clientY);
  };

  return (
    <div
      className={`card-block ${selected ? 'card-block--selected' : ''} ${editMode ? 'card-block--editable' : 'card-block--view'} ${isRearranging ? 'card-block--rearranging' : ''} ${isResizing ? 'card-block--resizing' : ''} ${canOverflow ? 'card-block--can-overflow' : ''} card-block--${blockType}`}
      style={{
        gridColumn: `${block.grid_column} / span ${block.col_span}`,
        gridRow: `${block.grid_row} / span ${block.row_span}`,
      }}
      onClick={editMode ? onSelect : undefined}
    >
      {showHeader && (
        <div
          className={`card-block__header ${!hasTitle || !showTitleEl ? 'card-block__header--no-title' : ''}`}
        >
          {showTitleEl && (
            editMode ? (
              editingTitle ? (
                <input
                  className="card-block__title-input"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
                    if (e.key === 'Escape') { cancelTitleEdit(); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={isLabel ? 'Label text' : '(no label)'}
                  autoFocus
                />
              ) : (
                <span
                  className={`card-block__title ${!hasTitle ? 'card-block__title--placeholder' : ''}`}
                  onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
                  title={isLabel ? 'Double-click to rename' : 'Double-click to edit label (clear it to remove)'}
                >
                  {hasTitle ? block.title : (isLabel ? 'Label' : '(no label)')}
                </span>
              )
            ) : (
              <span className="card-block__title">{block.title}</span>
            )
          )}
          {editMode && !editingTitle && (
            <div className="card-block__controls">
              {showTitleEl && (
                <button
                  className="card-block__control-btn"
                  onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
                  title="Edit label"
                >
                  &#9998;
                </button>
              )}
              {/* Hamburger = mouse-event drag handle. Using raw mouse events
                  (not HTML5 draggable) because wry's WebKitGTK silently drops
                  dragstart events from non-trivial DOM layouts — the fallback
                  is native text selection, which is what the user was seeing. */}
              <div
                role="button"
                tabIndex={0}
                className="card-block__control-btn card-block__drag-handle"
                onMouseDown={handleHamburgerMouseDown}
                onClick={(e) => e.stopPropagation()}
                title="Drag to move"
              >
                &#8801;
              </div>
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
      )}
      {showContent && (
        <div className="card-block__content">
          <TipTapEditor
            content={block.content}
            onUpdate={handleContentUpdate}
            editable={editMode}
            placeholder="Write content..."
            linkSource={{ type: 'character', id: block.character_id }}
          />
        </div>
      )}

      {/* Drag-to-resize handles. All four edges adjust the adjacent boundary;
          the bottom-right corner adjusts both at once. Labels skip the
          top/bottom/corner handles since they're locked to 1 row. */}
      {editMode && (
        <>
          <div
            className="card-block__resize-handle card-block__resize-handle--left"
            onMouseDown={handleResizeMouseDown('left')}
          />
          <div
            className="card-block__resize-handle card-block__resize-handle--right"
            onMouseDown={handleResizeMouseDown('right')}
          />
          {allowVerticalResize && (
            <>
              <div
                className="card-block__resize-handle card-block__resize-handle--top"
                onMouseDown={handleResizeMouseDown('top')}
              />
              <div
                className="card-block__resize-handle card-block__resize-handle--bottom"
                onMouseDown={handleResizeMouseDown('bottom')}
              />
              <div
                className="card-block__resize-handle card-block__resize-handle--corner"
                onMouseDown={handleResizeMouseDown('corner')}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
