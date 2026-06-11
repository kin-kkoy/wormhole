import { useEffect, useMemo, useRef, useState } from 'react';
import { commands } from '../../../lib/commands';
import type {
  LoreFolder,
  LoreDocumentSummary,
  LoreDocumentFull,
} from '../../../lib/commands';
import { useAppStore } from '../../../state/store';
import { BookTableOfContents } from '../../../components/lore/read/BookTableOfContents';
import {
  BookPage,
  BookPageEmpty,
} from '../../../components/lore/read/BookPage';
import type { AdjacentDocPosition } from '../../../components/lore/read/BookPage';
import { BookReferencesRail } from '../../../components/lore/read/BookReferencesRail';
import { BookColophon } from '../../../components/lore/read/BookColophon';
import {
  flattenBookOrder,
  toRomanNumeral,
} from '../../../components/lore/read/bookOrder';
import type { BookNode, ChapterNode } from '../../../components/lore/read/bookOrder';

interface BookReaderProps {
  book: BookNode;
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
  /** Per-doc "next page" overrides. If the current doc has an entry here,
   *  Next proposes that target instead of the flat-order neighbour. */
  nextPageMap: Map<string, string>;
  selectedDocumentId: string | null;
  onSelectDocument: (id: string | null) => void;
  /** Called after the colophon's "choose another volume" persists a new
   *  next_page_link, so the owner (LoreArchive) can refresh nextPageMap. */
  onNextPageLinksChanged?: () => void;
}

/** Find the chapter-level folder that contains the given doc, and return an
 *  eyebrow string for the BookPage header. Returns null for Foreword docs. */
function findChapterEyebrow(book: BookNode, docId: string): string | null {
  if (book.looseDocs.some((d) => d.id === docId)) return null;

  for (let i = 0; i < book.chapters.length; i++) {
    const chapter = book.chapters[i];
    if (chapterContains(chapter, docId)) {
      return `Chapter ${toRomanNumeral(i + 1).toUpperCase()} · ${chapter.folder.title}`;
    }
  }
  return null;
}

function chapterContains(chapter: ChapterNode, docId: string): boolean {
  if (chapter.docs.some((d) => d.id === docId)) return true;
  return chapter.pockets.some((p) => chapterContains(p, docId));
}

const NARROW_BREAKPOINT = 1100;
const NEW_DOC_TOAST_MS = 2500;
const EMPTY_SET: Set<string> = new Set();

export function BookReader({
  book,
  documents,
  nextPageMap,
  selectedDocumentId,
  onSelectDocument,
  onNextPageLinksChanged,
}: BookReaderProps) {
  const readerLayout = useAppStore((s) => s.readerLayout);
  const setReaderLayout = useAppStore((s) => s.setReaderLayout);
  const activeFolderPath = useAppStore((s) => s.activeFolderPath);
  const popFolderPathTo = useAppStore((s) => s.popFolderPathTo);
  const setSelectedDocumentId = useAppStore((s) => s.setSelectedDocumentId);
  const tocCollapsed = useAppStore((s) => s.tocCollapsed);
  const setTocCollapsed = useAppStore((s) => s.setTocCollapsed);

  const [activeDoc, setActiveDoc] = useState<LoreDocumentFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-doc read/bookmark state (Proposal 03) — backed by the world DB's
  // read_progress table so it travels with the .wormhole file.
  // readDocIds is null until the initial load resolves, so the mark-read
  // effect can't double-write the first opened doc.
  const [readDocIds, setReadDocIds] = useState<Set<string> | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let cancelled = false;
    commands
      .listReadProgress()
      .then((entries) => {
        if (cancelled) return;
        setReadDocIds(new Set(entries.filter((e) => e.read_at).map((e) => e.document_id)));
        setBookmarkedIds(new Set(entries.filter((e) => e.bookmarked).map((e) => e.document_id)));
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [book.id]);

  // Opening a document marks it read — once the initial load has resolved.
  useEffect(() => {
    if (!activeDoc || readDocIds === null) return;
    const id = activeDoc.id;
    if (readDocIds.has(id)) return;
    commands
      .markDocumentRead(id)
      .then(() => setReadDocIds((prev) => new Set(prev ?? []).add(id)))
      .catch(console.error);
  }, [activeDoc, readDocIds]);

  async function handleToggleBookmark() {
    if (!activeDoc) return;
    const id = activeDoc.id;
    try {
      const nowBookmarked = await commands.toggleDocumentBookmark(id);
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (nowBookmarked) next.add(id);
        else next.delete(id);
        return next;
      });
    } catch (e) {
      console.error('Failed to toggle bookmark:', e);
    }
  }
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < NARROW_BREAKPOINT,
  );
  const stageRef = useRef<HTMLDivElement>(null);

  // When navigating Prev at the start of a doc, we want to land on the last
  // sub-page of the PREVIOUS doc. This state stages the landing position
  // to pass to BookPage once the new doc is loaded.
  const [initialSubPagePos, setInitialSubPagePos] = useState<AdjacentDocPosition>('start');

  // Cross-doc confirm popup. When the user clicks Prev/Next at a doc
  // boundary, we don't auto-navigate — we surface a fade-in popup so the
  // user explicitly opts in (they often hit the boundary without realising
  // it would jump to a neighbouring document).
  type CrossDocPrompt = {
    direction: 'prev' | 'next';
    targetId: string;
    targetTitle: string;
    position: AdjacentDocPosition;
  };
  const [crossDocPrompt, setCrossDocPrompt] = useState<CrossDocPrompt | null>(null);

  // End-of-book colophon. Next at the last sub-page of the book's final
  // document opens this interstitial page instead of a confirm popup — the
  // colophon itself is the deliberate gate for leaving the book.
  const [showColophon, setShowColophon] = useState(false);
  useEffect(() => {
    setShowColophon(false);
  }, [selectedDocumentId, book.id]);

  // Subtle "Now reading: <title>" chip that appears briefly when the user
  // crosses a document boundary via prev/next. Null = hidden.
  const [newDocToast, setNewDocToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  // Track whether the doc change was caused by prev/next doc-crossing (vs
  // TOC click or initial load). Only prev/next doc-crossing triggers toast.
  const pendingToastRef = useRef(false);
  // First-render guard: no toast on the very first selection after mounting.
  const firstRenderRef = useRef(true);

  useEffect(() => {
    function handleResize() {
      setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const flatOrder = useMemo(() => flattenBookOrder(book), [book]);

  const currentIndex = useMemo(() => {
    if (!selectedDocumentId) return -1;
    return flatOrder.findIndex((d) => d.id === selectedDocumentId);
  }, [flatOrder, selectedDocumentId]);

  // Fetch the selected document.
  useEffect(() => {
    let cancelled = false;
    if (!selectedDocumentId) {
      setActiveDoc(null);
      setLoadError(null);
      return;
    }
    setLoadError(null);
    commands
      .getLoreDocument(selectedDocumentId)
      .then((doc) => {
        if (cancelled) return;
        setActiveDoc(doc);
        // If this change was triggered by a cross-doc nav (prev/next at
        // boundary), show the subtle "Now reading" chip.
        if (pendingToastRef.current && !firstRenderRef.current) {
          showToast(doc.title);
          pendingToastRef.current = false;
        }
        firstRenderRef.current = false;
      })
      .catch((e) => {
        console.error('Failed to load document:', e);
        if (cancelled) return;
        setActiveDoc(null);
        setLoadError('This page could not be loaded. It may have been removed.');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDocumentId]);

  // Clear toast timer on unmount.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showToast(title: string) {
    setNewDocToast(title);
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setNewDocToast(null);
      toastTimerRef.current = null;
    }, NEW_DOC_TOAST_MS);
  }

  // Scroll the stage to top on doc change — prevents carrying forward
  // the previous doc's scroll position (only matters in continuous mode).
  useEffect(() => {
    stageRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedDocumentId]);

  // Cross-doc nav: BookPage asks us to go to the neighbouring doc. Instead
  // of navigating directly we open a confirm popup; the nav only happens
  // if the user picks "Continue".
  function handlePrevDoc(position: AdjacentDocPosition) {
    if (currentIndex <= 0) return;
    const prev = flatOrder[currentIndex - 1];
    setCrossDocPrompt({
      direction: 'prev',
      targetId: prev.id,
      targetTitle: prev.title,
      // In paginated mode, Prev-at-start should land on last sub-page of
      // the previous doc; in continuous mode, always start at the top.
      position: position === 'end' ? 'end' : 'start',
    });
  }
  function handleNextDoc(_position: AdjacentDocPosition) {
    if (currentIndex < 0) return;
    // Last document in reading order → the colophon page, regardless of any
    // next_page_link override (the override is surfaced as the colophon's
    // continue card rather than via the popup).
    if (currentIndex === flatOrder.length - 1) {
      setShowColophon(true);
      return;
    }
    const current = flatOrder[currentIndex];
    const overrideId = current ? nextPageMap.get(current.id) : undefined;
    let next: LoreDocumentSummary | undefined;
    if (overrideId) {
      // Override may point outside the current book — search world-wide.
      next = documents.find((d) => d.id === overrideId);
    }
    if (!next && currentIndex < flatOrder.length - 1) {
      next = flatOrder[currentIndex + 1];
    }
    if (!next) return;
    setCrossDocPrompt({
      direction: 'next',
      targetId: next.id,
      targetTitle: next.title,
      position: 'start',
    });
  }

  function handleConfirmCrossDoc() {
    if (!crossDocPrompt) return;
    pendingToastRef.current = true;
    setInitialSubPagePos(crossDocPrompt.position);
    const id = crossDocPrompt.targetId;
    setCrossDocPrompt(null);
    onSelectDocument(id);
  }
  function handleCancelCrossDoc() {
    setCrossDocPrompt(null);
  }

  // Prev at the very first doc (no prev neighbour) walks the folder path
  // up one level — same effect as clicking the parent breadcrumb, but more
  // discoverable for non-developer users.
  const canGoUpLevel = activeFolderPath.length > 0;
  function handleGoUpLevel() {
    if (!canGoUpLevel) return;
    setSelectedDocumentId(null);
    popFolderPathTo(Math.max(0, activeFolderPath.length - 1));
  }

  const onPrevDoc = currentIndex > 0 ? handlePrevDoc : null;
  // Next is always enabled while a doc is selected: mid-book it proposes the
  // flat-order neighbour (or override) via the confirm popup; on the final
  // document it opens the end-of-book colophon page.
  const onNextDoc = currentIndex >= 0 ? handleNextDoc : null;

  // Colophon data: the book's final document owns the continue-to override.
  const lastDoc = flatOrder.length > 0 ? flatOrder[flatOrder.length - 1] : undefined;
  const colophonOverrideId = lastDoc ? nextPageMap.get(lastDoc.id) : undefined;
  const colophonTarget = colophonOverrideId
    ? documents.find((d) => d.id === colophonOverrideId) ?? null
    : null;

  function handleColophonContinue(targetId: string) {
    pendingToastRef.current = true;
    setInitialSubPagePos('start');
    setShowColophon(false);
    onSelectDocument(targetId);
  }

  async function handleColophonChooseVolume(target: LoreDocumentSummary) {
    if (!lastDoc) return;
    try {
      await commands.setNextPageLink({ documentId: lastDoc.id, targetId: target.id });
      onNextPageLinksChanged?.();
    } catch (e) {
      console.error('Failed to set next page link:', e);
    }
  }

  function handleColophonBack() {
    // Land on the last sub-page of the final doc (paginated mode); the
    // BookPage remount picks up 'end' via its pendingPosition mechanism.
    setInitialSubPagePos('end');
    setShowColophon(false);
  }

  function handleColophonReturnToLibrary() {
    if (canGoUpLevel) {
      handleGoUpLevel();
    } else {
      setSelectedDocumentId(null);
    }
  }
  // Only offer "go up a level" as the Prev fallback when the normal
  // doc-prev would be unavailable, so we don't short-circuit the popup.
  const onGoUpLevel = !onPrevDoc && canGoUpLevel ? handleGoUpLevel : null;

  // Dismiss the popup on Esc.
  useEffect(() => {
    if (!crossDocPrompt) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCrossDocPrompt(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [crossDocPrompt]);

  // Keyboard: ←/→ behave like clicking prev/next. Because BookPage owns
  // sub-page state, we bubble the event through a shared ref or DOM click
  // on the nav buttons. Simpler: dispatch click on the footer buttons.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (target.isContentEditable) return;

      const stage = stageRef.current;
      if (!stage) return;
      const selector =
        e.key === 'ArrowLeft'
          ? '.book-page__footer-nav:first-of-type'
          : '.book-page__footer-nav:last-of-type';
      const btn = stage.querySelector<HTMLButtonElement>(selector);
      if (btn && !btn.disabled) {
        e.preventDefault();
        btn.click();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Reset initialSubPagePos to 'start' after a navigation settles so a
  // subsequent TOC click doesn't inherit stale 'end' intent.
  useEffect(() => {
    if (initialSubPagePos === 'end') {
      // Clear after BookPage has had a chance to apply it.
      const t = window.setTimeout(() => setInitialSubPagePos('start'), 400);
      return () => window.clearTimeout(t);
    }
  }, [initialSubPagePos, selectedDocumentId]);

  const chapterEyebrow = activeDoc ? findChapterEyebrow(book, activeDoc.id) : null;
  const readerClass =
    (isNarrow ? 'book-reader book-reader--no-rail' : 'book-reader')
    + (tocCollapsed ? ' book-reader--toc-collapsed' : '');

  return (
    <div className={readerClass}>
      <div className="book-reader__toc">
        <div className="book-reader__toc-header">
          {!tocCollapsed && (
            <span className="book-reader__toc-header-label">Contents</span>
          )}
          <button
            type="button"
            className="book-reader__toc-collapse"
            onClick={() => setTocCollapsed(!tocCollapsed)}
            title={tocCollapsed ? 'Show contents' : 'Hide contents'}
            aria-label={tocCollapsed ? 'Show contents' : 'Hide contents'}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              {tocCollapsed ? (
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
        {!tocCollapsed && (
          <BookTableOfContents
            book={book}
            selectedDocumentId={selectedDocumentId}
            readDocIds={readDocIds ?? EMPTY_SET}
            onSelectDocument={(id) => {
              // TOC click is not a cross-doc "prev/next" — no toast.
              pendingToastRef.current = false;
              setInitialSubPagePos('start');
              onSelectDocument(id);
            }}
          />
        )}
      </div>

      <div className="book-reader__stage" ref={stageRef}>
        {crossDocPrompt && (
          <>
            <div
              className="book-reader__cross-doc-backdrop"
              onClick={handleCancelCrossDoc}
              aria-hidden="true"
            />
            <div
              className="book-reader__cross-doc-popup"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cross-doc-title"
            >
              <div className="book-reader__cross-doc-eyebrow">
                {crossDocPrompt.direction === 'next' ? 'End of page' : 'Start of page'}
              </div>
              <div className="book-reader__cross-doc-title" id="cross-doc-title">
                {crossDocPrompt.direction === 'next'
                  ? 'Continue to the next document?'
                  : 'Go back to the previous document?'}
              </div>
              <div className="book-reader__cross-doc-target">
                {crossDocPrompt.targetTitle}
              </div>
              <div className="book-reader__cross-doc-actions">
                <button
                  type="button"
                  className="book-reader__cross-doc-btn book-reader__cross-doc-btn--ghost"
                  onClick={handleCancelCrossDoc}
                >
                  Stay here
                </button>
                <button
                  type="button"
                  className="book-reader__cross-doc-btn book-reader__cross-doc-btn--primary"
                  onClick={handleConfirmCrossDoc}
                  autoFocus
                >
                  {crossDocPrompt.direction === 'next' ? 'Continue →' : '← Go back'}
                </button>
              </div>
            </div>
          </>
        )}
        {newDocToast && (
          <div className="book-reader__new-doc-toast" role="status" aria-live="polite">
            <span className="book-reader__new-doc-toast-label">Now reading</span>
            <span className="book-reader__new-doc-toast-title">{newDocToast}</span>
          </div>
        )}

        {showColophon && lastDoc ? (
          <BookColophon
            bookTitle={book.title}
            lastDocId={lastDoc.id}
            continueTarget={colophonTarget}
            documents={documents}
            onContinue={handleColophonContinue}
            onChooseVolume={handleColophonChooseVolume}
            onBack={handleColophonBack}
            onReturnToLibrary={handleColophonReturnToLibrary}
          />
        ) : activeDoc ? (
          <BookPage
            document={activeDoc}
            bookmarked={bookmarkedIds.has(activeDoc.id)}
            onToggleBookmark={handleToggleBookmark}
            chapterLabel={chapterEyebrow}
            docIndex={Math.max(currentIndex, 0)}
            docCount={flatOrder.length}
            onPrevDoc={onPrevDoc}
            onNextDoc={onNextDoc}
            onGoUpLevel={onGoUpLevel}
            showInlineReferences={isNarrow}
            layout={readerLayout}
            onLayoutChange={setReaderLayout}
            initialSubPagePosition={initialSubPagePos}
          />
        ) : loadError ? (
          <BookPageEmpty
            message={loadError}
            layout={readerLayout}
            onLayoutChange={setReaderLayout}
          />
        ) : flatOrder.length === 0 ? (
          <BookPageEmpty
            message="This book has no pages yet. Switch to Write to add some."
            layout={readerLayout}
            onLayoutChange={setReaderLayout}
          />
        ) : (
          <BookPageEmpty
            message="Choose a page from the table of contents to begin reading."
            layout={readerLayout}
            onLayoutChange={setReaderLayout}
          />
        )}
      </div>

      {!isNarrow && (
        <div className="book-reader__rail">
          {activeDoc ? (
            <BookReferencesRail documentId={activeDoc.id} variant="rail" />
          ) : (
            <div className="book-refs">
              <h3 className="book-refs__title">References</h3>
              <div className="book-refs__empty">Select a page to see its links.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
