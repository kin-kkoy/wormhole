import { useCallback, useEffect, useState, useRef } from 'react';
import type { CardBlock as CardBlockType, BlockPositionUpdate } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { CardBlock } from './CardBlock';
import type { PresetDragRef } from './CardBlockDock';
import './CardGrid.css';

interface CardGridProps {
  blocks: CardBlockType[];
  characterId: string;
  editMode: boolean;
  onRefresh: () => void;
  presetDragRef: PresetDragRef;
}

const COLS = 3;
const ROWS = 7;

interface GhostState {
  /** Top-left grid coordinate (1-indexed) */
  col: number;
  row: number;
  cols: number;
  rows: number;
  valid: boolean;
  label: string;
}

// Drives the view-mode "can overflow" affordance: a block with nothing
// underneath in its column range can let long content spill into the empty
// cells below instead of triggering an internal scrollbar.
function hasBlockBelow(target: CardBlockType, all: CardBlockType[]): boolean {
  const targetBottomRow = target.grid_row + target.row_span;
  const targetColStart = target.grid_column;
  const targetColEnd = target.grid_column + target.col_span;
  return all.some((b) => {
    if (b.id === target.id) return false;
    const colOverlap = b.grid_column < targetColEnd && b.grid_column + b.col_span > targetColStart;
    const isBelow = b.grid_row >= targetBottomRow;
    return colOverlap && isBelow;
  });
}

/** Clamp a target top-left coord so the block stays fully within the grid. */
function clampToGrid(col: number, row: number, cols: number, rows: number) {
  return {
    col: Math.max(1, Math.min(COLS - cols + 1, col)),
    row: Math.max(1, Math.min(ROWS - rows + 1, row)),
  };
}

interface Placement {
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

function rectsOverlap(a: Placement, b: Placement): boolean {
  return (
    a.col < b.col + b.colSpan &&
    a.col + a.colSpan > b.col &&
    a.row < b.row + b.rowSpan &&
    a.row + a.rowSpan > b.row
  );
}

/** Cascading push-down: given a target placement, shift any overlapping
 *  blocks (transitively) downward by 1 row per iteration until nothing
 *  overlaps. Returns final placements for every non-target block, or null
 *  if any block would be pushed past the bottom of the grid. Preserves
 *  relative top-to-bottom order. */
function reflowPushDown(
  targetPlacement: Placement,
  otherBlocks: CardBlockType[],
  rows: number,
): Map<string, Placement> | null {
  const placements = new Map<string, Placement>();
  for (const b of otherBlocks) {
    placements.set(b.id, {
      col: b.grid_column,
      row: b.grid_row,
      colSpan: b.col_span,
      rowSpan: b.row_span,
    });
  }

  const safety = 500;
  for (let iter = 0; iter < safety; iter++) {
    let changed = false;
    for (const [id, p] of placements) {
      let overlaps = rectsOverlap(p, targetPlacement);
      if (!overlaps) {
        for (const [otherId, otherP] of placements) {
          if (otherId === id) continue;
          if (rectsOverlap(p, otherP)) {
            overlaps = true;
            break;
          }
        }
      }
      if (!overlaps) continue;

      const nextRow = p.row + 1;
      if (nextRow + p.rowSpan - 1 > rows) return null;
      placements.set(id, { ...p, row: nextRow });
      changed = true;
    }
    if (!changed) return placements;
  }
  return null;
}

type ResizeDirection = 'right' | 'bottom' | 'corner' | 'left' | 'top';

interface ResizeState {
  blockId: string;
  /** Starting block placement — locked at mousedown. */
  startCol: number;
  startRow: number;
  startColSpan: number;
  startRowSpan: number;
  /** Which edge/corner is being dragged. */
  direction: ResizeDirection;
  /** Starting cursor position. */
  startClientX: number;
  startClientY: number;
  /** Current (live) placement. Left/top directions move col/row as the
   *  block grows or shrinks from that edge. */
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
  /** True once reflow would succeed at the current placement — drives ghost color. */
  valid: boolean;
}

export function CardGrid({ blocks, characterId, editMode, onRefresh, presetDragRef }: CardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  const getCellFromEvent = useCallback((e: React.DragEvent): { col: number; row: number } | null => {
    if (!gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const relY = e.clientY - rect.top;
    const cellWidth = rect.width / COLS;
    const cellHeight = rect.height / ROWS;
    const col = Math.floor(relX / cellWidth) + 1;
    const row = Math.floor(relY / cellHeight) + 1;
    if (col < 1 || col > COLS || row < 1 || row > ROWS) return null;
    return { col, row };
  }, []);

  /** Resolve the current drag — now only preset palette drags use the HTML5
   *  drag path; existing-block rearrangement is handled via raw mouse events
   *  below because wry's WebKitGTK silently fails HTML5 drag from block
   *  elements. */
  const resolveDragInfo = useCallback(() => {
    const preset = presetDragRef.current;
    if (preset) {
      return {
        kind: 'preset' as const,
        existingBlockId: null,
        cols: preset.cols,
        rows: preset.rows,
        label: preset.title,
        grabOffset: { col: 0, row: 0 },
      };
    }
    return null;
  }, [blocks, presetDragRef]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const cursor = getCellFromEvent(e);
    if (!cursor) {
      setGhost(null);
      return;
    }
    const info = resolveDragInfo();
    if (!info) {
      setGhost(null);
      return;
    }

    // Preset drops always target the cell under the cursor (no grab offset
    // since palette rows don't carry a within-block origin).
    const { col, row } = clampToGrid(cursor.col, cursor.row, info.cols, info.rows);

    // Validity now means "reflow would succeed" — overlapping cells are OK
    // as long as the pushed-down neighbors still fit within the grid.
    const targetPlacement: Placement = { col, row, colSpan: info.cols, rowSpan: info.rows };
    const valid = reflowPushDown(targetPlacement, blocks, ROWS) !== null;

    setGhost({ col, row, cols: info.cols, rows: info.rows, valid, label: info.label });
  }, [getCellFromEvent, resolveDragInfo, blocks]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const cursor = getCellFromEvent(e);
    const info = resolveDragInfo();
    setGhost(null);

    if (!cursor || !info) {
      presetDragRef.current = null;
      return;
    }

    const { col, row } = clampToGrid(cursor.col, cursor.row, info.cols, info.rows);

    const targetPlacement: Placement = { col, row, colSpan: info.cols, rowSpan: info.rows };
    const reflow = reflowPushDown(targetPlacement, blocks, ROWS);
    if (!reflow) {
      presetDragRef.current = null;
      return;
    }

    // Build the batch of position updates for blocks that actually moved.
    const positionUpdates: BlockPositionUpdate[] = [];
    for (const [id, p] of reflow) {
      const original = blocks.find((b) => b.id === id);
      if (!original) continue;
      if (
        original.grid_column !== p.col ||
        original.grid_row !== p.row ||
        original.col_span !== p.colSpan ||
        original.row_span !== p.rowSpan
      ) {
        positionUpdates.push({
          id,
          grid_column: p.col,
          grid_row: p.row,
          col_span: p.colSpan,
          row_span: p.rowSpan,
        });
      }
    }

    // Title comes from dataTransfer so Text presets (which use the palette
    // label for the drag ghost but an empty real title) get stored with
    // exactly what the preset specified.
    const blockTitle = e.dataTransfer.getData('text/block-title');
    const rawType = e.dataTransfer.getData('text/block-type');
    const blockType: 'label' | 'text' | 'standard' =
      rawType === 'label' || rawType === 'text' ? rawType : 'standard';
    const presetUnique = e.dataTransfer.getData('text/block-unique') === '1';
    try {
      if (positionUpdates.length > 0) {
        await commands.batchUpdateBlockPositions(positionUpdates);
      }
      await commands.createCardBlock({
        characterId,
        title: blockTitle,
        gridColumn: col,
        gridRow: row,
        colSpan: info.cols,
        rowSpan: info.rows,
        blockType,
        presetUnique,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to create block:', err);
    } finally {
      presetDragRef.current = null;
    }
  }, [getCellFromEvent, resolveDragInfo, blocks, characterId, onRefresh, presetDragRef]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if the cursor truly left the grid (not just entered a child).
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      setGhost(null);
    }
  }, []);

  // ─── Drag-to-resize ────────────────────────────────────────────────────────
  // The block border shows right / bottom / corner handles on hover (edit mode).
  // Mousedown on a handle starts a resize; window listeners track the cursor
  // until mouseup, which commits via reflowPushDown + batchUpdateBlockPositions.
  const resizeStateRef = useRef<ResizeState | null>(null);
  const [resizing, setResizing] = useState(false);
  const [resizingBlockId, setResizingBlockId] = useState<string | null>(null);

  const handleResizeStart = useCallback(
    (blockId: string, direction: ResizeDirection, clientX: number, clientY: number) => {
      const block = blocks.find((b) => b.id === blockId);
      if (!block) return;
      resizeStateRef.current = {
        blockId,
        startCol: block.grid_column,
        startRow: block.grid_row,
        startColSpan: block.col_span,
        startRowSpan: block.row_span,
        direction,
        startClientX: clientX,
        startClientY: clientY,
        col: block.grid_column,
        row: block.grid_row,
        colSpan: block.col_span,
        rowSpan: block.row_span,
        valid: true,
      };
      setResizingBlockId(blockId);
      setResizing(true);
      setSelectedBlockId(blockId);
    },
    [blocks],
  );

  useEffect(() => {
    if (!resizing) return;
    const gridEl = gridRef.current;
    if (!gridEl) return;

    const onMove = (e: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const rect = gridEl.getBoundingClientRect();
      const cellWidth = rect.width / COLS;
      const cellHeight = rect.height / ROWS;
      const dCols = Math.round((e.clientX - state.startClientX) / cellWidth);
      const dRows = Math.round((e.clientY - state.startClientY) / cellHeight);

      let newCol = state.startCol;
      let newRow = state.startRow;
      let newColSpan = state.startColSpan;
      let newRowSpan = state.startRowSpan;

      // Right edge and bottom-right corner: grow/shrink toward the right.
      if (state.direction === 'right' || state.direction === 'corner') {
        newColSpan = Math.max(
          1,
          Math.min(COLS - state.startCol + 1, state.startColSpan + dCols),
        );
      }
      // Bottom edge and corner: grow/shrink downward.
      if (state.direction === 'bottom' || state.direction === 'corner') {
        newRowSpan = Math.max(
          1,
          Math.min(ROWS - state.startRow + 1, state.startRowSpan + dRows),
        );
      }
      // Left edge: right boundary stays pinned, col moves with cursor.
      if (state.direction === 'left') {
        const d = Math.max(
          -(state.startCol - 1),           // can't pull past col 1
          Math.min(state.startColSpan - 1, dCols), // can't squeeze below span 1
        );
        newCol = state.startCol + d;
        newColSpan = state.startColSpan - d;
      }
      // Top edge: bottom boundary stays pinned, row moves with cursor.
      if (state.direction === 'top') {
        const d = Math.max(
          -(state.startRow - 1),
          Math.min(state.startRowSpan - 1, dRows),
        );
        newRow = state.startRow + d;
        newRowSpan = state.startRowSpan - d;
      }

      const target: Placement = {
        col: newCol,
        row: newRow,
        colSpan: newColSpan,
        rowSpan: newRowSpan,
      };
      const others = blocks.filter((b) => b.id !== state.blockId);
      const valid = reflowPushDown(target, others, ROWS) !== null;

      state.col = newCol;
      state.row = newRow;
      state.colSpan = newColSpan;
      state.rowSpan = newRowSpan;
      state.valid = valid;

      setGhost({
        col: newCol,
        row: newRow,
        cols: newColSpan,
        rows: newRowSpan,
        valid,
        label: '',
      });
    };

    const onUp = async () => {
      const state = resizeStateRef.current;
      resizeStateRef.current = null;
      setResizing(false);
      setResizingBlockId(null);
      setGhost(null);
      if (!state) return;
      if (
        state.col === state.startCol &&
        state.row === state.startRow &&
        state.colSpan === state.startColSpan &&
        state.rowSpan === state.startRowSpan
      ) {
        return;
      }
      if (!state.valid) return;

      const target: Placement = {
        col: state.col,
        row: state.row,
        colSpan: state.colSpan,
        rowSpan: state.rowSpan,
      };
      const others = blocks.filter((b) => b.id !== state.blockId);
      const reflow = reflowPushDown(target, others, ROWS);
      if (!reflow) return;

      const positionUpdates: BlockPositionUpdate[] = [];
      for (const [id, p] of reflow) {
        const original = others.find((b) => b.id === id);
        if (!original) continue;
        if (
          original.grid_column !== p.col ||
          original.grid_row !== p.row ||
          original.col_span !== p.colSpan ||
          original.row_span !== p.rowSpan
        ) {
          positionUpdates.push({
            id,
            grid_column: p.col,
            grid_row: p.row,
            col_span: p.colSpan,
            row_span: p.rowSpan,
          });
        }
      }
      positionUpdates.push({
        id: state.blockId,
        grid_column: state.col,
        grid_row: state.row,
        col_span: state.colSpan,
        row_span: state.rowSpan,
      });

      try {
        await commands.batchUpdateBlockPositions(positionUpdates);
        onRefresh();
      } catch (err) {
        console.error('Failed to resize block:', err);
      }
    };

    // Same text-selection guard as the rearrange effect — otherwise a slow
    // drag can paint highlights across editor content.
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [resizing, blocks, onRefresh]);

  const handleDeleteBlock = useCallback(async (blockId: string) => {
    try {
      await commands.deleteCardBlock(blockId);
      setSelectedBlockId(null);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete block:', err);
    }
  }, [onRefresh]);

  const handleBlockContentUpdate = useCallback(async (blockId: string, content: string) => {
    try {
      await commands.updateCardBlock({ blockId, content });
    } catch (err) {
      console.error('Failed to update block content:', err);
    }
  }, []);

  const handleBlockTitleUpdate = useCallback(async (blockId: string, title: string) => {
    try {
      await commands.updateCardBlock({ blockId, title });
      onRefresh();
    } catch (err) {
      console.error('Failed to update block title:', err);
    }
  }, [onRefresh]);

  // ─── Mouse-based rearrange ─────────────────────────────────────────────────
  // wry's WebKitGTK silently drops HTML5 dragstart events from block-shaped
  // DOM in several layouts (text selection takes over instead). We do the
  // rearrange ourselves with mousedown on the hamburger + window-level
  // mousemove/mouseup, mirroring how drag-to-resize already works.
  interface RearrangeState {
    blockId: string;
    startCol: number;
    startRow: number;
    colSpan: number;
    rowSpan: number;
    /** Which cell within the block the user grabbed, 0-indexed. Preserves
     *  the cursor's anchor point so the block tracks the cursor naturally. */
    grabOffsetCol: number;
    grabOffsetRow: number;
    /** Live target cell (top-left). */
    col: number;
    row: number;
    valid: boolean;
  }
  const rearrangeStateRef = useRef<RearrangeState | null>(null);
  const [rearranging, setRearranging] = useState(false);
  const [rearrangingBlockId, setRearrangingBlockId] = useState<string | null>(null);

  const handleRearrangeStart = useCallback(
    (blockId: string, clientX: number, clientY: number) => {
      const block = blocks.find((b) => b.id === blockId);
      const gridEl = gridRef.current;
      if (!block || !gridEl) return;
      const rect = gridEl.getBoundingClientRect();
      const cellWidth = rect.width / COLS;
      const cellHeight = rect.height / ROWS;
      const blockLeftPx = rect.left + (block.grid_column - 1) * cellWidth;
      const blockTopPx = rect.top + (block.grid_row - 1) * cellHeight;
      const grabOffsetCol = Math.max(
        0,
        Math.min(block.col_span - 1, Math.floor((clientX - blockLeftPx) / cellWidth)),
      );
      const grabOffsetRow = Math.max(
        0,
        Math.min(block.row_span - 1, Math.floor((clientY - blockTopPx) / cellHeight)),
      );
      rearrangeStateRef.current = {
        blockId,
        startCol: block.grid_column,
        startRow: block.grid_row,
        colSpan: block.col_span,
        rowSpan: block.row_span,
        grabOffsetCol,
        grabOffsetRow,
        col: block.grid_column,
        row: block.grid_row,
        valid: true,
      };
      setRearrangingBlockId(blockId);
      setRearranging(true);
      setSelectedBlockId(blockId);
    },
    [blocks],
  );

  useEffect(() => {
    if (!rearranging) return;
    const gridEl = gridRef.current;
    if (!gridEl) return;

    const onMove = (e: MouseEvent) => {
      const state = rearrangeStateRef.current;
      if (!state) return;
      const rect = gridEl.getBoundingClientRect();
      const cellWidth = rect.width / COLS;
      const cellHeight = rect.height / ROWS;
      const cursorCol = Math.max(
        1,
        Math.min(COLS, Math.floor((e.clientX - rect.left) / cellWidth) + 1),
      );
      const cursorRow = Math.max(
        1,
        Math.min(ROWS, Math.floor((e.clientY - rect.top) / cellHeight) + 1),
      );
      const rawCol = cursorCol - state.grabOffsetCol;
      const rawRow = cursorRow - state.grabOffsetRow;
      const col = Math.max(1, Math.min(COLS - state.colSpan + 1, rawCol));
      const row = Math.max(1, Math.min(ROWS - state.rowSpan + 1, rawRow));

      const target: Placement = { col, row, colSpan: state.colSpan, rowSpan: state.rowSpan };
      const others = blocks.filter((b) => b.id !== state.blockId);
      const valid = reflowPushDown(target, others, ROWS) !== null;

      state.col = col;
      state.row = row;
      state.valid = valid;

      setGhost({
        col,
        row,
        cols: state.colSpan,
        rows: state.rowSpan,
        valid,
        label: '',
      });
    };

    const onUp = async () => {
      const state = rearrangeStateRef.current;
      rearrangeStateRef.current = null;
      setRearranging(false);
      setRearrangingBlockId(null);
      setGhost(null);
      if (!state) return;
      if (state.col === state.startCol && state.row === state.startRow) return;
      if (!state.valid) return;

      const target: Placement = {
        col: state.col,
        row: state.row,
        colSpan: state.colSpan,
        rowSpan: state.rowSpan,
      };
      const others = blocks.filter((b) => b.id !== state.blockId);
      const reflow = reflowPushDown(target, others, ROWS);
      if (!reflow) return;

      const positionUpdates: BlockPositionUpdate[] = [];
      for (const [id, p] of reflow) {
        const original = others.find((b) => b.id === id);
        if (!original) continue;
        if (
          original.grid_column !== p.col ||
          original.grid_row !== p.row ||
          original.col_span !== p.colSpan ||
          original.row_span !== p.rowSpan
        ) {
          positionUpdates.push({
            id,
            grid_column: p.col,
            grid_row: p.row,
            col_span: p.colSpan,
            row_span: p.rowSpan,
          });
        }
      }
      positionUpdates.push({
        id: state.blockId,
        grid_column: state.col,
        grid_row: state.row,
        col_span: state.colSpan,
        row_span: state.rowSpan,
      });

      try {
        await commands.batchUpdateBlockPositions(positionUpdates);
        onRefresh();
      } catch (err) {
        console.error('Failed to rearrange block:', err);
      }
    };

    // Disable native text selection globally for the duration of the
    // rearrange — otherwise a stray drag without HTML5 dragstart support
    // paints a text highlight across whatever's under the cursor.
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = prevUserSelect;
    };
  }, [rearranging, blocks, onRefresh]);

  return (
    <div
      ref={gridRef}
      className={`card-grid ${editMode ? 'card-grid--editing' : ''}`}
      onDragOver={editMode ? handleDragOver : undefined}
      onDrop={editMode ? handleDrop : undefined}
      onDragLeave={editMode ? handleDragLeave : undefined}
      onClick={() => setSelectedBlockId(null)}
    >
      {/* Subtle cell grid in edit mode (no per-cell color states anymore — the
          ghost block below carries the placement preview). */}
      {editMode && Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = (i % COLS) + 1;
        const row = Math.floor(i / COLS) + 1;
        return (
          <div
            key={`cell-${col}-${row}`}
            className="card-grid__cell"
            style={{ gridColumn: col, gridRow: row }}
          />
        );
      })}

      {/* Ghost block — single rectangle at the would-be drop position,
          colored green if the placement is valid or red if it would overlap. */}
      {editMode && ghost && (
        <div
          className={`card-grid__ghost ${ghost.valid ? 'card-grid__ghost--valid' : 'card-grid__ghost--invalid'}`}
          style={{
            gridColumn: `${ghost.col} / span ${ghost.cols}`,
            gridRow: `${ghost.row} / span ${ghost.rows}`,
          }}
        >
          {ghost.label && <span className="card-grid__ghost-label">{ghost.label}</span>}
        </div>
      )}

      {/* Blocks */}
      {blocks.map((block) => (
        <CardBlock
          key={block.id}
          block={block}
          editMode={editMode}
          selected={selectedBlockId === block.id}
          isResizing={resizingBlockId === block.id}
          isRearranging={rearrangingBlockId === block.id}
          hasBlockBelow={hasBlockBelow(block, blocks)}
          onSelect={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); }}
          onResizeStart={handleResizeStart}
          onRearrangeStart={handleRearrangeStart}
          onDelete={handleDeleteBlock}
          onContentUpdate={handleBlockContentUpdate}
          onTitleUpdate={handleBlockTitleUpdate}
        />
      ))}
    </div>
  );
}
