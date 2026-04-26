import { useCallback, useState } from 'react';

interface EntryWithId {
  id: string;
}

export interface EntryReorder {
  dragIndex: number | null;
  dragOverIndex: number | null;
  isDropTarget: (index: number) => boolean;
  handleDragStart: (e: React.DragEvent, index: number) => void;
  handleDragOver: (e: React.DragEvent, index: number) => void;
  handleDragLeave: (index: number) => void;
  handleDrop: (e: React.DragEvent, dropIndex: number) => void;
  handleDragEnd: () => void;
}

// Mirrors DetailTabBar's cross-section reorder pattern for in-section entries.
// Optimistic splice → persist via onReorder once; no backend command needed.
export function useEntryReorder<T extends EntryWithId>(
  entries: T[],
  onReorder: (next: T[]) => void,
): EntryReorder {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((index: number) => {
    setDragOverIndex((prev) => (prev === index ? null : prev));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const next = [...entries];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    setDragOverIndex(null);
    onReorder(next);
  }, [dragIndex, entries, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  const isDropTarget = useCallback(
    (index: number) => dragOverIndex === index && dragIndex !== null && dragIndex !== index,
    [dragIndex, dragOverIndex],
  );

  return {
    dragIndex,
    dragOverIndex,
    isDropTarget,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  };
}
