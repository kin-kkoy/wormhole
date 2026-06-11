import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import type { LinkableRecord } from '../../lib/commands';
import './InlineLinkAutocomplete.css';

/** One selectable row in the `[[` autocomplete dropdown. Group headers are
 *  render-only and never part of this list, so keyboard navigation walks
 *  records and create-rows without special cases. */
export type AcItem =
  | { kind: 'record'; record: LinkableRecord }
  | { kind: 'create'; entityType: 'lore_document' | 'character' };

/** Build the selectable item list: lore documents, then characters, then —
 *  for a non-empty query — the two create-in-place rows. */
export function buildAutocompleteItems(results: LinkableRecord[], query: string): AcItem[] {
  const items: AcItem[] = [
    ...results
      .filter((r) => r.entity_type === 'lore_document')
      .map((record) => ({ kind: 'record' as const, record })),
    ...results
      .filter((r) => r.entity_type === 'character')
      .map((record) => ({ kind: 'record' as const, record })),
  ];
  if (query.trim() !== '') {
    items.push({ kind: 'create', entityType: 'lore_document' });
    items.push({ kind: 'create', entityType: 'character' });
  }
  return items;
}

interface InlineLinkAutocompleteProps {
  items: AcItem[];
  query: string;
  selectedIndex: number;
  coords: { left: number; bottom: number };
  onSelect: (item: AcItem) => void;
  onHover: (index: number) => void;
  dropdownRef: RefObject<HTMLDivElement | null>;
}

/** Shared dropdown for the `[[` inline-link autocomplete (lore document
 *  editor + character prose sections). Portaled to document.body so it
 *  escapes transformed ancestors like the character flip container. */
export function InlineLinkAutocomplete({
  items,
  query,
  selectedIndex,
  coords,
  onSelect,
  onHover,
  dropdownRef,
}: InlineLinkAutocompleteProps) {
  if (items.length === 0) return null;

  const rows: ReactNode[] = [];
  let prevGroup: string | null = null;

  items.forEach((item, idx) => {
    const group =
      item.kind === 'create' ? 'create' : item.record.entity_type;
    if (group !== prevGroup) {
      prevGroup = group;
      if (group === 'lore_document') {
        rows.push(
          <div key="h-lore" className="il-ac__header">
            <span className="il-ac__dot" data-type="lore_document" />
            Lore
          </div>,
        );
      } else if (group === 'character') {
        rows.push(
          <div key="h-char" className="il-ac__header">
            <span className="il-ac__dot" data-type="character" />
            Characters
          </div>,
        );
      } else {
        rows.push(<div key="h-create" className="il-ac__divider" />);
      }
    }

    const selected = idx === selectedIndex;
    if (item.kind === 'record') {
      const { record } = item;
      rows.push(
        <button
          key={`${record.entity_type}-${record.id}`}
          type="button"
          className={`il-ac__item ${selected ? 'il-ac__item--selected' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          onMouseEnter={() => onHover(idx)}
        >
          <span className="il-ac__badge" data-type={record.entity_type}>
            {record.entity_type === 'character' ? 'CHR' : 'DOC'}
          </span>
          <span className="il-ac__name">{record.name}</span>
        </button>,
      );
    } else {
      rows.push(
        <button
          key={`create-${item.entityType}`}
          type="button"
          className={`il-ac__item il-ac__item--create ${selected ? 'il-ac__item--selected' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          onMouseEnter={() => onHover(idx)}
        >
          <span className="il-ac__plus">＋</span>
          <span className="il-ac__name">
            Create “{query.trim()}” as{' '}
            {item.entityType === 'lore_document' ? 'Lore document' : 'Character'}
          </span>
        </button>,
      );
    }
  });

  return createPortal(
    <div
      ref={dropdownRef}
      className="il-ac"
      style={{ left: coords.left, top: coords.bottom + 4 }}
    >
      {rows}
    </div>,
    document.body,
  );
}
