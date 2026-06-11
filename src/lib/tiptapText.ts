/** Extract readable plain text from stored TipTap JSON (used for glossary
 *  hover-card excerpts). Walks the node tree collecting text leaves; blocks
 *  are joined with spaces; output is truncated with an ellipsis. Returns ''
 *  for empty/unparseable input. */
export function tiptapJsonToText(json: string | null | undefined, maxChars: number): string {
  if (!json) return '';
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    // Not JSON — treat as already-plain text.
    return truncate(String(json).trim(), maxChars);
  }

  const parts: string[] = [];
  walk(doc, parts);
  return truncate(parts.join(' ').replace(/\s+/g, ' ').trim(), maxChars);
}

function walk(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === 'text' && typeof n.text === 'string') {
    out.push(n.text);
    return;
  }
  if (Array.isArray(n.content)) {
    for (const child of n.content) walk(child, out);
  }
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  // Cut at the last word boundary before the limit so we never split a word.
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…';
}
