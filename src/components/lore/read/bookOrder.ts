import type { LoreFolder, LoreDocumentSummary } from '../../../lib/commands';
import { LOOSE_BOOK_ID } from '../../../state/store';

export interface ChapterNode {
  folder: LoreFolder;
  pockets: ChapterNode[];
  docs: LoreDocumentSummary[];
  depth: number;
}

export interface BookNode {
  /** Root folder for a real book; null for the synthetic Loose Pages book. */
  folder: LoreFolder | null;
  id: string;
  title: string;
  /** Docs sitting directly under the book root (no chapter) — become a Foreword. */
  looseDocs: LoreDocumentSummary[];
  chapters: ChapterNode[];
}

function sortFolders<T extends { sort_order: number; title: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
}

function sortDocs(list: LoreDocumentSummary[]): LoreDocumentSummary[] {
  return [...list].sort((a, b) => a.title.localeCompare(b.title));
}

function buildChapter(
  folder: LoreFolder,
  childrenByParent: Map<string, LoreFolder[]>,
  docsByFolder: Map<string, LoreDocumentSummary[]>,
  depth: number,
): ChapterNode {
  const childFolders = sortFolders(childrenByParent.get(folder.id) ?? []);
  const pockets = childFolders.map((child) =>
    buildChapter(child, childrenByParent, docsByFolder, depth + 1),
  );
  const docs = sortDocs(docsByFolder.get(folder.id) ?? []);
  return { folder, pockets, docs, depth };
}

export function buildBookTree(
  rootId: string,
  folders: LoreFolder[],
  documents: LoreDocumentSummary[],
): BookNode | null {
  const childrenByParent = new Map<string, LoreFolder[]>();
  for (const f of folders) {
    const key = f.parent_folder_id ?? '__ROOT__';
    const arr = childrenByParent.get(key);
    if (arr) arr.push(f);
    else childrenByParent.set(key, [f]);
  }

  const docsByFolder = new Map<string, LoreDocumentSummary[]>();
  const looseWorldDocs: LoreDocumentSummary[] = [];
  for (const d of documents) {
    if (d.folder_id) {
      const arr = docsByFolder.get(d.folder_id);
      if (arr) arr.push(d);
      else docsByFolder.set(d.folder_id, [d]);
    } else {
      looseWorldDocs.push(d);
    }
  }

  if (rootId === LOOSE_BOOK_ID) {
    if (looseWorldDocs.length === 0) return null;
    return {
      folder: null,
      id: LOOSE_BOOK_ID,
      title: 'Loose Pages',
      looseDocs: sortDocs(looseWorldDocs),
      chapters: [],
    };
  }

  // We intentionally do NOT require parent_folder_id === null. The tile-
  // navigation flow can drill into a sub-folder that has no further sub-
  // folders and treat it as a virtual book root for the reader's TOC.
  const root = folders.find((f) => f.id === rootId);
  if (!root) return null;

  const chapters = sortFolders(childrenByParent.get(root.id) ?? []).map((child) =>
    buildChapter(child, childrenByParent, docsByFolder, 1),
  );
  const looseDocs = sortDocs(docsByFolder.get(root.id) ?? []);

  return {
    folder: root,
    id: root.id,
    title: root.title,
    looseDocs,
    chapters,
  };
}

/** Flatten a book into reading order: loose docs → each chapter (docs, then nested pockets depth-first). */
export function flattenBookOrder(book: BookNode): LoreDocumentSummary[] {
  const out: LoreDocumentSummary[] = [];
  for (const d of book.looseDocs) out.push(d);
  for (const c of book.chapters) walkChapter(c, out);
  return out;
}

function walkChapter(chapter: ChapterNode, out: LoreDocumentSummary[]): void {
  for (const d of chapter.docs) out.push(d);
  for (const p of chapter.pockets) walkChapter(p, out);
}

/** Counts for cover display. */
export function countChapters(book: BookNode): number {
  return book.chapters.length;
}
export function countPages(book: BookNode): number {
  return flattenBookOrder(book).length;
}

/** All root folders in the archive, sorted. Convenience for library shelf. */
export function listRootFolders(folders: LoreFolder[]): LoreFolder[] {
  return sortFolders(folders.filter((f) => f.parent_folder_id === null));
}

/** Immediate children of a folder (sub-folders + documents), sorted. Used by
 *  the sub-library tile view to show what lives under a given folder. */
export function listFolderChildren(
  folderId: string,
  folders: LoreFolder[],
  documents: LoreDocumentSummary[],
): { subFolders: LoreFolder[]; docs: LoreDocumentSummary[] } {
  const subFolders = sortFolders(folders.filter((f) => f.parent_folder_id === folderId));
  const docs = sortDocs(documents.filter((d) => d.folder_id === folderId));
  return { subFolders, docs };
}

/** True if there is at least one document with folder_id === null. */
export function hasLooseDocs(documents: LoreDocumentSummary[]): boolean {
  return documents.some((d) => d.folder_id === null);
}

/** Find the root folder id (book id) that contains the given document. Returns
 *  LOOSE_BOOK_ID if the document is at world root. Returns null if the doc's
 *  folder chain is broken / folder not found. */
export function findBookIdForDocument(
  docId: string,
  folders: LoreFolder[],
  documents: LoreDocumentSummary[],
): string | null {
  const doc = documents.find((d) => d.id === docId);
  if (!doc) return null;
  if (doc.folder_id === null) return LOOSE_BOOK_ID;
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  let current = folderMap.get(doc.folder_id);
  while (current) {
    if (current.parent_folder_id === null) return current.id;
    current = folderMap.get(current.parent_folder_id);
  }
  return null;
}

/** Full folder ancestry from world root down to (and including) the given
 *  folder. Used by the path-based navigation to drill the user into a
 *  deeply-nested doc without skipping intermediate sub-books. */
export function computeFolderAncestry(
  folderId: string,
  folders: LoreFolder[],
): string[] {
  const map = new Map(folders.map((f) => [f.id, f]));
  const path: string[] = [];
  let current = map.get(folderId);
  // Guard against cycles — cap traversal at 10 (schema max depth is 5).
  for (let i = 0; i < 10 && current; i++) {
    path.unshift(current.id);
    current = current.parent_folder_id ? map.get(current.parent_folder_id) : undefined;
  }
  return path;
}

/** Shallow-equality check for two folder paths. */
export function pathsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Deterministic spine color from book id. Returns an HSL string. */
export function getSpineColor(bookId: string): string {
  if (bookId === LOOSE_BOOK_ID) {
    // Loose Pages: muted gray spine.
    return 'hsl(30, 6%, 42%)';
  }
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = (hash * 31 + bookId.charCodeAt(i)) | 0;
  }
  // Palette tuned to sit well against warm paper: avoid neon, bias toward
  // earthy tones (ochre, indigo, rust, moss, plum, teal).
  const hues = [24, 210, 12, 120, 285, 180, 45, 340];
  const hue = hues[Math.abs(hash) % hues.length];
  const sat = 42 + (Math.abs(hash >> 4) % 18); // 42–60
  const light = 38 + (Math.abs(hash >> 8) % 10); // 38–48
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

/** Turn a number (1-based) into lowercase Roman numerals for page footers. */
export function toRomanNumeral(n: number): string {
  if (n <= 0) return '';
  const pairs: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ];
  let out = '';
  let remaining = n;
  for (const [value, symbol] of pairs) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}
