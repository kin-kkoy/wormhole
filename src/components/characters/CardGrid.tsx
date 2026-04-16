import { useCallback, useState, useRef } from 'react';
import type { CardBlock as CardBlockType } from '../../lib/commands';
import { commands } from '../../lib/commands';
import { CardBlock } from './CardBlock';
import './CardGrid.css';

interface CardGridProps {
  blocks: CardBlockType[];
  characterId: string;
  editMode: boolean;
  onRefresh: () => void;
}

const COLS = 3;
const ROWS = 5;

function getOccupiedCells(blocks: CardBlockType[], excludeId?: string): Set<string> {
  const cells = new Set<string>();
  for (const block of blocks) {
    if (block.id === excludeId) continue;
    for (let c = block.grid_column; c < block.grid_column + block.col_span; c++) {
      for (let r = block.grid_row; r < block.grid_row + block.row_span; r++) {
        cells.add(`${c}-${r}`);
      }
    }
  }
  return cells;
}

function wouldOverlap(
  occupied: Set<string>,
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
): boolean {
  if (col < 1 || row < 1 || col + colSpan - 1 > COLS || row + rowSpan - 1 > ROWS) return true;
  for (let c = col; c < col + colSpan; c++) {
    for (let r = row; r < row + rowSpan; r++) {
      if (occupied.has(`${c}-${r}`)) return true;
    }
  }
  return false;
}

function getCellsForPlacement(col: number, row: number, colSpan: number, rowSpan: number): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (let c = col; c < col + colSpan; c++) {
    for (let r = row; r < row + rowSpan; r++) {
      cells.push({ col: c, row: r });
    }
  }
  return cells;
}

export function CardGrid({ blocks, characterId, editMode, onRefresh }: CardGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragHighlight, setDragHighlight] = useState<{ cells: { col: number; row: number }[]; valid: boolean } | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // Track dragged block ID via ref (dataTransfer.getData unavailable in dragover)
  const draggedBlockIdRef = useRef<string | null>(null);

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const cell = getCellFromEvent(e);
    if (!cell) {
      setDragHighlight(null);
      return;
    }

    // Determine block size and exclusion
    const existingBlockId = draggedBlockIdRef.current;
    const block = existingBlockId ? blocks.find((b) => b.id === existingBlockId) : null;
    const colSpan = block ? block.col_span : 1;
    const rowSpan = block ? block.row_span : 1;

    const occForCheck = getOccupiedCells(blocks, existingBlockId ?? undefined);
    const valid = !wouldOverlap(occForCheck, cell.col, cell.row, colSpan, rowSpan);
    const cells = getCellsForPlacement(cell.col, cell.row, colSpan, rowSpan);
    setDragHighlight({ cells, valid });
  }, [getCellFromEvent, blocks]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const cell = getCellFromEvent(e);
    setDragHighlight(null);
    draggedBlockIdRef.current = null;

    if (!cell) return;

    // Check if it's a new block from the dock
    const blockTitle = e.dataTransfer.getData('text/block-title');
    const existingBlockId = e.dataTransfer.getData('text/block-id');

    if (blockTitle && !existingBlockId) {
      // Creating a new block
      const occForCheck = getOccupiedCells(blocks);
      if (wouldOverlap(occForCheck, cell.col, cell.row, 1, 1)) return;

      try {
        await commands.createCardBlock({
          characterId,
          title: blockTitle,
          gridColumn: cell.col,
          gridRow: cell.row,
        });
        onRefresh();
      } catch (err) {
        console.error('Failed to create block:', err);
      }
    } else if (existingBlockId) {
      // Repositioning existing block
      const block = blocks.find((b) => b.id === existingBlockId);
      if (!block) return;

      const occForCheck = getOccupiedCells(blocks, existingBlockId);
      if (wouldOverlap(occForCheck, cell.col, cell.row, block.col_span, block.row_span)) return;

      try {
        await commands.updateCardBlock({
          blockId: existingBlockId,
          gridColumn: cell.col,
          gridRow: cell.row,
        });
        onRefresh();
      } catch (err) {
        console.error('Failed to move block:', err);
      }
    }
  }, [getCellFromEvent, blocks, characterId, onRefresh]);

  const handleDragLeave = useCallback(() => {
    setDragHighlight(null);
  }, []);

  const handleResize = useCallback(async (blockId: string, dimension: 'col' | 'row') => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;

    let newColSpan = block.col_span;
    let newRowSpan = block.row_span;

    if (dimension === 'col') {
      newColSpan = (block.col_span % 3) + 1; // cycle 1→2→3→1
    } else {
      newRowSpan = block.row_span === 1 ? 2 : 1; // toggle 1↔2
    }

    // Validate
    const occForCheck = getOccupiedCells(blocks, blockId);
    if (wouldOverlap(occForCheck, block.grid_column, block.grid_row, newColSpan, newRowSpan)) {
      return; // reject resize
    }

    try {
      await commands.updateCardBlock({
        blockId,
        colSpan: newColSpan,
        rowSpan: newRowSpan,
      });
      onRefresh();
    } catch (err) {
      console.error('Failed to resize block:', err);
    }
  }, [blocks, onRefresh]);

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

  // Set ref when a block starts dragging so handleDragOver knows the block size
  const handleBlockDragStart = useCallback((blockId: string) => {
    draggedBlockIdRef.current = blockId;
  }, []);

  return (
    <div
      ref={gridRef}
      className={`card-grid ${editMode ? 'card-grid--editing' : ''}`}
      onDragOver={editMode ? handleDragOver : undefined}
      onDrop={editMode ? handleDrop : undefined}
      onDragLeave={editMode ? handleDragLeave : undefined}
      onClick={() => setSelectedBlockId(null)}
    >
      {/* Grid cell backgrounds for edit mode */}
      {editMode && Array.from({ length: COLS * ROWS }, (_, i) => {
        const col = (i % COLS) + 1;
        const row = Math.floor(i / COLS) + 1;
        const isHighlight = dragHighlight?.cells.some((h) => h.col === col && h.row === row);
        return (
          <div
            key={`cell-${col}-${row}`}
            className={`card-grid__cell ${isHighlight ? (dragHighlight?.valid ? 'card-grid__cell--valid' : 'card-grid__cell--invalid') : ''}`}
            style={{
              gridColumn: col,
              gridRow: row,
            }}
          />
        );
      })}

      {/* Blocks */}
      {blocks.map((block) => (
        <CardBlock
          key={block.id}
          block={block}
          editMode={editMode}
          selected={selectedBlockId === block.id}
          onSelect={(e) => { e.stopPropagation(); setSelectedBlockId(block.id); }}
          onResize={handleResize}
          onDelete={handleDeleteBlock}
          onContentUpdate={handleBlockContentUpdate}
          onDragStart={handleBlockDragStart}
        />
      ))}
    </div>
  );
}
