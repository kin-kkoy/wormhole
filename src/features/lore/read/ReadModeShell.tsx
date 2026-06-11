import { useEffect, useMemo } from 'react';
import type { LoreFolder, LoreDocumentSummary } from '../../../lib/commands';
import {
  useAppStore,
  LOOSE_BOOK_ID,
  STACK_SEGMENT,
} from '../../../state/store';
import { LibraryShelf } from './LibraryShelf';
import { BookReader } from './BookReader';
import {
  SubLibraryView,
  ExpandedStackView,
  LooseStackView,
} from './SubLibraryView';
import {
  buildBookTree,
  computeFolderAncestry,
  listFolderChildren,
  pathsEqual,
} from '../../../components/lore/read/bookOrder';

// Paper height floor — captured once at module load so the paper stays
// "fullscreen-equivalent" even when the user drags the window smaller.
// We take the biggest of: screen.availHeight (monitor minus taskbar),
// initial innerHeight (the window when Read Mode first mounts), and a
// hard floor of 900px. Subtracting ~120px reserves room for the mode-
// toggle row + app chrome when the window IS maximized, so the paper
// fits inside the stage without forcing a scroll on a big window. The
// value is clamped to [700, 1400] to avoid absurdly small/tall papers.
function capturePaperMinH() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const raw = Math.max(
    window.screen?.availHeight ?? 0,
    window.innerHeight || 0,
    900,
  );
  const paperMinH = Math.max(700, Math.min(1400, raw - 120));
  // Never shrink the floor within a session — always keep the largest seen.
  const current = parseInt(
    document.documentElement.style.getPropertyValue('--paper-min-h') || '0',
    10,
  );
  const next = Math.max(current, paperMinH);
  document.documentElement.style.setProperty('--paper-min-h', `${next}px`);
}
capturePaperMinH();

interface ReadModeShellProps {
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
  /** source-doc-id → override target-doc-id. Populated from
   *  `listNextPageLinks` in LoreArchive. When a source doc has an entry,
   *  the reader's "Next" button proposes that target instead of the
   *  default flat-order next. */
  nextPageMap: Map<string, string>;
  onSwitchToWrite: () => void;
  /** Bubbles up from the reader's colophon when a next_page_link changes. */
  onNextPageLinksChanged?: () => void;
}

export function ReadModeShell({
  folders,
  documents,
  nextPageMap,
  onSwitchToWrite,
  onNextPageLinksChanged,
}: ReadModeShellProps) {
  const activeFolderPath = useAppStore((s) => s.activeFolderPath);
  const setActiveFolderPath = useAppStore((s) => s.setActiveFolderPath);
  const pushFolderPath = useAppStore((s) => s.pushFolderPath);
  const selectedDocumentId = useAppStore((s) => s.selectedDocumentId);
  const setSelectedDocumentId = useAppStore((s) => s.setSelectedDocumentId);

  // Module-load may have happened before the Tauri window finished sizing,
  // so re-capture once on mount — we keep the largest value we've ever
  // seen (never shrink), matching the "fullscreen-equivalent" intent.
  useEffect(() => {
    capturePaperMinH();
  }, []);

  // Classify the current path into one of the view modes. `selectedDocumentId`
  // is passed in so routing can prefer reader whenever a doc is selected,
  // even if the current folder would otherwise show sub-library tiles.
  const routing = useMemo(
    () => routePath(activeFolderPath, folders, documents, selectedDocumentId),
    [activeFolderPath, folders, documents, selectedDocumentId],
  );

  // Heal stale paths (e.g. after a folder was deleted in Write mode).
  useEffect(() => {
    if (routing.kind === 'invalid') {
      setActiveFolderPath([]);
      setSelectedDocumentId(null);
    }
  }, [routing.kind, setActiveFolderPath, setSelectedDocumentId]);

  // Cross-doc routing: whenever a doc becomes selected, ensure the folder
  // path matches the doc's full ancestry. This handles two cases:
  //   1. Inline [[link]] to a doc in a different book → path jumps to that
  //      book's full ancestry, reader opens.
  //   2. User selects a doc at depth 2+ via a PageTile in a mixed tile
  //      view → path already matches ancestry; no-op.
  // Without this, a cross-book link could leave the user stranded in a
  // sub-library view of the wrong book.
  useEffect(() => {
    if (!selectedDocumentId) return;
    const doc = documents.find((d) => d.id === selectedDocumentId);
    if (!doc) return;
    const desiredPath =
      doc.folder_id === null
        ? [LOOSE_BOOK_ID]
        : computeFolderAncestry(doc.folder_id, folders);
    if (desiredPath.length === 0) return;
    if (!pathsEqual(desiredPath, activeFolderPath)) {
      setActiveFolderPath(desiredPath);
    }
  }, [selectedDocumentId, folders, documents, activeFolderPath, setActiveFolderPath]);

  function handleOpenBook(rootFolderId: string) {
    setActiveFolderPath([rootFolderId]);
    // If the book has no sub-folders, auto-select the first page so the
    // reader has something to show. If it has sub-folders, the user will
    // see the sub-library tile view and pick a tile explicitly.
    const book = buildBookTree(rootFolderId, folders, documents);
    if (!book) return;
    const hasSubFolders = folders.some((f) => f.parent_folder_id === rootFolderId);
    if (!hasSubFolders) {
      // Reader view — pre-select first doc in reading order.
      const { docs } = listFolderChildren(rootFolderId, folders, documents);
      setSelectedDocumentId(docs[0]?.id ?? null);
    } else {
      setSelectedDocumentId(null);
    }
  }

  function handleOpenLooseStack() {
    setActiveFolderPath([LOOSE_BOOK_ID]);
    setSelectedDocumentId(null);
  }

  function handleOpenSubFolder(subFolderId: string) {
    pushFolderPath(subFolderId);
    const hasSubFolders = folders.some((f) => f.parent_folder_id === subFolderId);
    if (!hasSubFolders) {
      const { docs } = listFolderChildren(subFolderId, folders, documents);
      setSelectedDocumentId(docs[0]?.id ?? null);
    } else {
      setSelectedDocumentId(null);
    }
  }

  function handleExpandStack() {
    pushFolderPath(STACK_SEGMENT);
  }

  function handleOpenDocument(docId: string) {
    setSelectedDocumentId(docId);
  }

  return (
    <div className="read-mode-shell">
      {routing.kind === 'library' && (
        <LibraryShelf
          folders={folders}
          documents={documents}
          onOpenBook={handleOpenBook}
          onOpenLooseStack={handleOpenLooseStack}
          onSwitchToWrite={onSwitchToWrite}
        />
      )}

      {routing.kind === 'sub-library' && (
        <SubLibraryView
          folder={routing.folder}
          folders={folders}
          documents={documents}
          depth={routing.depth}
          onOpenSubFolder={handleOpenSubFolder}
          onOpenDocument={handleOpenDocument}
          onExpandStack={handleExpandStack}
        />
      )}

      {routing.kind === 'expanded-stack' && (
        <ExpandedStackView
          folder={routing.folder}
          folders={folders}
          documents={documents}
          onOpenDocument={handleOpenDocument}
        />
      )}

      {routing.kind === 'loose-stack' && (
        <LooseStackView
          documents={documents}
          onOpenDocument={handleOpenDocument}
        />
      )}

      {routing.kind === 'reader' && (
        <BookReader
          book={routing.book}
          folders={folders}
          documents={documents}
          nextPageMap={nextPageMap}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={setSelectedDocumentId}
          onNextPageLinksChanged={onNextPageLinksChanged}
        />
      )}
    </div>
  );
}

// ─── Routing ──────────────────────────────────────────────────────────────

type Route =
  | { kind: 'library' }
  | { kind: 'loose-stack' }
  | { kind: 'sub-library'; folder: LoreFolder; depth: number }
  | { kind: 'expanded-stack'; folder: LoreFolder }
  | { kind: 'reader'; book: ReturnType<typeof buildBookTree> & object }
  | { kind: 'invalid' };

function routePath(
  path: string[],
  folders: LoreFolder[],
  documents: LoreDocumentSummary[],
  selectedDocumentId: string | null,
): Route {
  if (path.length === 0) return { kind: 'library' };

  // World-root Loose Pages. If a loose doc is selected, show reader;
  // otherwise the expanded PageTile view.
  if (path.length === 1 && path[0] === LOOSE_BOOK_ID) {
    if (selectedDocumentId) {
      const book = buildBookTree(LOOSE_BOOK_ID, folders, documents);
      if (book) return { kind: 'reader', book };
    }
    return { kind: 'loose-stack' };
  }

  // Expanded stack segment. Similar override: selected doc → reader on the
  // parent folder (so TOC shows sibling pages). Otherwise the expanded view.
  if (path[path.length - 1] === STACK_SEGMENT) {
    const parentId = path[path.length - 2];
    if (!parentId) return { kind: 'invalid' };
    const parent = folders.find((f) => f.id === parentId);
    if (!parent) return { kind: 'invalid' };
    if (selectedDocumentId) {
      const book = buildBookTree(parentId, folders, documents);
      if (book) return { kind: 'reader', book };
    }
    return { kind: 'expanded-stack', folder: parent };
  }

  // Real folder leaf.
  const leafId = path[path.length - 1];
  const leaf = folders.find((f) => f.id === leafId);
  if (!leaf) return { kind: 'invalid' };

  // A selected doc takes priority over the sub-library decision. This is
  // what makes cross-book inline links land in the reader even when the
  // target's containing folder has its own sub-folders.
  if (selectedDocumentId) {
    const book = buildBookTree(leafId, folders, documents);
    if (book) return { kind: 'reader', book };
  }

  const hasSubFolders = folders.some((f) => f.parent_folder_id === leafId);
  if (hasSubFolders) {
    return { kind: 'sub-library', folder: leaf, depth: path.length };
  }

  const book = buildBookTree(leafId, folders, documents);
  if (!book) return { kind: 'invalid' };
  return { kind: 'reader', book };
}
