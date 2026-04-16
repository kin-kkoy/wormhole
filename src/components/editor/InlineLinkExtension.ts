import { Node, mergeAttributes } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';

export interface InlineLinkAttrs {
  entityType: string;
  entityId: string;
  label: string;
}

const ENTITY_COLORS: Record<string, string> = {
  character: 'var(--accent-characters)',
  map_entity: 'var(--accent-atlas)',
  lore_document: 'var(--accent-lore)',
};

export const InlineLinkNode = Node.create({
  name: 'inlineLink',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      entityType: { default: null },
      entityId: { default: null },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-inline-link]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const color = ENTITY_COLORS[HTMLAttributes.entityType] || 'var(--text-secondary)';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-inline-link': '',
        'data-entity-type': HTMLAttributes.entityType,
        'data-entity-id': HTMLAttributes.entityId,
        class: 'inline-link',
        style: `color: ${color}; cursor: pointer; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px;`,
        title: `${HTMLAttributes.entityType}: ${HTMLAttributes.label}`,
      }),
      HTMLAttributes.label || '[unknown]',
    ];
  },
});

// ─── Helpers for [[ autocomplete ─────────────────────────────────────────────

interface ResolvedPos {
  parent: {
    childCount: number;
    child: (index: number) => { isText: boolean; text?: string | null; nodeSize: number };
  };
  start: () => number;
  parentOffset: number;
}

/**
 * Detect if the cursor is inside a [[ trigger within the current paragraph.
 * Walks the ProseMirror node tree to correctly map text indices to document positions,
 * accounting for inline atom nodes (like existing inlineLink nodes) that occupy
 * document positions but produce no text.
 */
export function detectBracketTrigger(
  doc: { resolve: (pos: number) => ResolvedPos },
  cursorPos: number,
): { query: string; startPos: number } | null {
  const $pos = doc.resolve(cursorPos);
  const parent = $pos.parent;
  const parentStart = $pos.start();
  const cursorOffset = $pos.parentOffset;

  // Walk parent's children, build text + position map up to cursor
  let text = '';
  const posMap: number[] = []; // posMap[textIndex] = documentPosition
  let docOffset = 0;

  for (let i = 0; i < parent.childCount; i++) {
    const child = parent.child(i);
    if (docOffset >= cursorOffset) break;

    if (child.isText && child.text) {
      const maxChars = Math.min(child.text.length, cursorOffset - docOffset);
      for (let j = 0; j < maxChars; j++) {
        posMap.push(parentStart + docOffset + j);
        text += child.text[j];
      }
    }
    // Non-text inline nodes (like inlineLink atoms) take up nodeSize positions
    // but contribute nothing to the text string — docOffset still advances
    docOffset += child.nodeSize;
  }

  const bracketIdx = text.lastIndexOf('[[');
  if (bracketIdx < 0) return null;

  const afterBracket = text.slice(bracketIdx + 2);
  if (afterBracket.includes(']]')) return null;
  if (afterBracket.includes('\n')) return null;

  const startPos = posMap[bracketIdx];
  if (startPos === undefined) return null;

  return { query: afterBracket, startPos };
}

/**
 * Insert an inline link node, replacing from startPos to cursor.
 */
export function insertInlineLink(
  view: EditorView,
  startPos: number,
  attrs: InlineLinkAttrs,
) {
  const { state, dispatch } = view;
  const endPos = state.selection.from;

  const nodeType = state.schema.nodes.inlineLink;
  if (!nodeType) return;

  const node = nodeType.create(attrs);
  const tr = state.tr.replaceWith(startPos, endPos, node);
  dispatch(tr);
  view.focus();
}
