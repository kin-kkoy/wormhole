// Pure conversion logic between detail-section layout types.
// No I/O, no React — kept standalone for easy reasoning.

export type LayoutType = 'prose' | 'cards' | 'timeline' | 'grid';

export interface CardEntry {
  id: string;
  title: string;
  subtitle: string;
  description: string;
}

export interface TimelineEntry {
  id: string;
  date: string;
  title: string;
  description: string;
}

export interface KVEntry {
  id: string;
  label: string;
  value: string;
}

export interface ConversionResult {
  /** Replacement for `content` (TipTap JSON string). `null` means leave the field unchanged. */
  content: string | null;
  /** Replacement for `structured_content_json` (JSON-stringified array). `null` = unchanged. */
  structuredContentJson: string | null;
  /** Plaintext of anything that will be dropped; `null` for lossless conversions. */
  dump: string | null;
  /** Number of entries carried over (0 for prose → structured). */
  carriedCount: number;
  /** True iff `dump` is non-empty. */
  lossy: boolean;
  /** One-line summary for the confirm dialog. */
  summary: string;
}

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  prose: 'Prose',
  cards: 'Cards',
  timeline: 'Timeline',
  grid: 'Key-Value',
};

function safeParseArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// Walk a TipTap JSON doc and return readable plaintext, inserting a blank
// line between top-level block nodes so paragraphs don't collapse together.
export function tiptapToPlainText(raw: string | null | undefined): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return nodeToText(parsed).trim();
  } catch {
    return '';
  }
}

function nodeToText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;
  if (typeof n.text === 'string') return n.text;
  if (Array.isArray(n.content)) {
    const inner = n.content.map(nodeToText).join(n.type === 'paragraph' ? '' : '');
    // Top-level doc: join children with blank lines.
    if (n.type === 'doc') {
      return (n.content as unknown[])
        .map((child) => nodeToText(child))
        .filter((s) => s.length > 0)
        .join('\n\n');
    }
    return inner;
  }
  return '';
}

// Build a TipTap doc from an array of paragraph specs. Each paragraph is a
// list of (text, optional marks) runs.
type Run = { text: string; bold?: boolean; italic?: boolean };

function makeDoc(paragraphs: Run[][]): string {
  const doc = {
    type: 'doc',
    content: paragraphs
      .filter((runs) => runs.some((r) => r.text.length > 0))
      .map((runs) => ({
        type: 'paragraph',
        content: runs
          .filter((r) => r.text.length > 0)
          .map((r) => {
            const marks: { type: string }[] = [];
            if (r.bold) marks.push({ type: 'bold' });
            if (r.italic) marks.push({ type: 'italic' });
            return marks.length > 0
              ? { type: 'text', text: r.text, marks }
              : { type: 'text', text: r.text };
          }),
      })),
  };
  return JSON.stringify(doc);
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// ─── Conversion matrix ────────────────────────────────────────────────────────

export function convertSection(
  from: LayoutType,
  to: LayoutType,
  content: string | null,
  structured: string | null,
): ConversionResult {
  if (from === to) {
    return {
      content: null,
      structuredContentJson: null,
      dump: null,
      carriedCount: 0,
      lossy: false,
      summary: 'Already in this layout.',
    };
  }

  // ── Prose → structured (always lossy if prose has any text) ─────────────
  if (from === 'prose') {
    const plain = tiptapToPlainText(content);
    const lossy = plain.length > 0;
    return {
      content: null, // keep old prose JSON in the row; it's unused for structured layouts
      structuredContentJson: JSON.stringify([]),
      dump: lossy ? plain : null,
      carriedCount: 0,
      lossy,
      summary: lossy
        ? 'Prose cannot be auto-split into entries. Copy the dump below first, then convert to start with an empty list.'
        : 'Section is empty. Conversion will create an empty list.',
    };
  }

  // ── Structured → prose (lossless) ───────────────────────────────────────
  if (to === 'prose') {
    const doc = structuredToProse(from, structured);
    const count = countEntries(from, structured);
    return {
      content: doc,
      structuredContentJson: JSON.stringify([]),
      dump: null,
      carriedCount: count,
      lossy: false,
      summary:
        count === 0
          ? 'Section is empty. Conversion will create an empty prose section.'
          : `${count} entr${count === 1 ? 'y' : 'ies'} will be joined into paragraphs.`,
    };
  }

  // ── Structured → structured ─────────────────────────────────────────────
  if (from === 'cards') {
    const cards = safeParseArray<CardEntry>(structured);
    const droppedSubs = cards
      .filter((c) => c.subtitle?.trim().length > 0)
      .map((c) => `${c.title || '(untitled)'} — ${c.subtitle}`);

    if (to === 'timeline') {
      const next: TimelineEntry[] = cards.map((c) => ({
        id: c.id || newId(),
        date: '',
        title: c.title,
        description: c.description,
      }));
      const lossy = droppedSubs.length > 0;
      return {
        content: null,
        structuredContentJson: JSON.stringify(next),
        dump: lossy ? `Dropped subtitles:\n${droppedSubs.join('\n')}` : null,
        carriedCount: cards.length,
        lossy,
        summary:
          `${cards.length} card${cards.length === 1 ? '' : 's'} will become timeline entries${
            lossy ? `; ${droppedSubs.length} subtitle${droppedSubs.length === 1 ? '' : 's'} will be dropped` : ''
          }.`,
      };
    }
    if (to === 'grid') {
      const next: KVEntry[] = cards.map((c) => ({
        id: c.id || newId(),
        label: c.title,
        value: c.description,
      }));
      const lossy = droppedSubs.length > 0;
      return {
        content: null,
        structuredContentJson: JSON.stringify(next),
        dump: lossy ? `Dropped subtitles:\n${droppedSubs.join('\n')}` : null,
        carriedCount: cards.length,
        lossy,
        summary:
          `${cards.length} card${cards.length === 1 ? '' : 's'} will become label/value rows${
            lossy ? `; ${droppedSubs.length} subtitle${droppedSubs.length === 1 ? '' : 's'} will be dropped` : ''
          }.`,
      };
    }
  }

  if (from === 'timeline') {
    const entries = safeParseArray<TimelineEntry>(structured);
    if (to === 'cards') {
      const next: CardEntry[] = entries.map((e) => ({
        id: e.id || newId(),
        title: e.title,
        subtitle: e.date,
        description: e.description,
      }));
      return {
        content: null,
        structuredContentJson: JSON.stringify(next),
        dump: null,
        carriedCount: entries.length,
        lossy: false,
        summary: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} will become cards (date → subtitle).`,
      };
    }
    if (to === 'grid') {
      const next: KVEntry[] = entries.map((e) => ({
        id: e.id || newId(),
        label: e.date ? `${e.date} — ${e.title}` : e.title,
        value: e.description,
      }));
      return {
        content: null,
        structuredContentJson: JSON.stringify(next),
        dump: null,
        carriedCount: entries.length,
        lossy: false,
        summary: `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} will become label/value rows.`,
      };
    }
  }

  if (from === 'grid') {
    const rows = safeParseArray<KVEntry>(structured);
    if (to === 'cards') {
      const next: CardEntry[] = rows.map((r) => ({
        id: r.id || newId(),
        title: r.label,
        subtitle: '',
        description: r.value,
      }));
      return {
        content: null,
        structuredContentJson: JSON.stringify(next),
        dump: null,
        carriedCount: rows.length,
        lossy: false,
        summary: `${rows.length} row${rows.length === 1 ? '' : 's'} will become cards.`,
      };
    }
    if (to === 'timeline') {
      const next: TimelineEntry[] = rows.map((r) => ({
        id: r.id || newId(),
        date: '',
        title: r.label,
        description: r.value,
      }));
      return {
        content: null,
        structuredContentJson: JSON.stringify(next),
        dump: null,
        carriedCount: rows.length,
        lossy: false,
        summary: `${rows.length} row${rows.length === 1 ? '' : 's'} will become timeline entries.`,
      };
    }
  }

  // Fallback — should be unreachable with valid inputs.
  return {
    content: null,
    structuredContentJson: null,
    dump: null,
    carriedCount: 0,
    lossy: false,
    summary: 'Unsupported conversion.',
  };
}

function countEntries(from: LayoutType, structured: string | null): number {
  if (from === 'cards') return safeParseArray<CardEntry>(structured).length;
  if (from === 'timeline') return safeParseArray<TimelineEntry>(structured).length;
  if (from === 'grid') return safeParseArray<KVEntry>(structured).length;
  return 0;
}

function structuredToProse(from: LayoutType, structured: string | null): string {
  if (from === 'cards') {
    const cards = safeParseArray<CardEntry>(structured);
    const paragraphs: Run[][] = [];
    for (const c of cards) {
      if (c.title) paragraphs.push([{ text: c.title, bold: true }]);
      if (c.subtitle) paragraphs.push([{ text: c.subtitle, italic: true }]);
      if (c.description) paragraphs.push([{ text: c.description }]);
    }
    return makeDoc(paragraphs);
  }
  if (from === 'timeline') {
    const entries = safeParseArray<TimelineEntry>(structured);
    const paragraphs: Run[][] = [];
    for (const e of entries) {
      const header: Run[] = [];
      if (e.date) header.push({ text: e.date, italic: true });
      if (e.date && e.title) header.push({ text: ' — ' });
      if (e.title) header.push({ text: e.title, bold: true });
      if (header.length > 0) paragraphs.push(header);
      if (e.description) paragraphs.push([{ text: e.description }]);
    }
    return makeDoc(paragraphs);
  }
  if (from === 'grid') {
    const rows = safeParseArray<KVEntry>(structured);
    const paragraphs: Run[][] = [];
    for (const r of rows) {
      const line: Run[] = [];
      if (r.label) line.push({ text: `${r.label}: `, bold: true });
      if (r.value) line.push({ text: r.value });
      if (line.length > 0) paragraphs.push(line);
    }
    return makeDoc(paragraphs);
  }
  return JSON.stringify({ type: 'doc', content: [] });
}
