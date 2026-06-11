import { useEffect, useRef, useState } from 'react';
import type { LoreDocumentFull } from '../../../lib/commands';
import { TipTapEditor } from '../../editor/TipTapEditor';
import { toRomanNumeral } from './bookOrder';
import { BookReferencesRail } from './BookReferencesRail';
import { LayoutToggle } from './LayoutToggle';
import { PaginatedBody } from './PaginatedBody';
import type { ReaderLayout } from '../../../state/store';

/** Request to move to an adjacent document. The `position` tells the next
 *  BookPage whether to start at the first or last sub-page — useful when
 *  navigating backwards: pressing Prev at sub-page 0 should take the user
 *  to the previous document's LAST page, not its first. */
export type AdjacentDocPosition = 'start' | 'end';

interface BookPageProps {
  document: LoreDocumentFull;
  /** e.g. "Chapter II · The Loom of Tides". Null for Foreword / loose docs. */
  chapterLabel: string | null;
  /** Book-level position of this document (not sub-page). Used for the
   *  "iv of x" document counter in the footer. */
  docIndex: number;
  docCount: number;
  /** Document traversal at book boundaries. Returning null disables the action. */
  onPrevDoc: ((position: AdjacentDocPosition) => void) | null;
  onNextDoc: ((position: AdjacentDocPosition) => void) | null;
  /** When there is no previous document in the flow (user is on the first
   *  sub-page of the first doc), Prev falls back to this: walk the folder
   *  path up one level. Null if already at the top. */
  onGoUpLevel: (() => void) | null;
  /** Render references inline below the page (when the rail is hidden). */
  showInlineReferences: boolean;
  /** Current reader layout. */
  layout: ReaderLayout;
  /** Layout toggle handler (upper-right button). */
  onLayoutChange: (layout: ReaderLayout) => void;
  /** When the parent navigated in via onPrevDoc, this is set to 'end' so the
   *  new BookPage starts on its last sub-page once columns are measured.
   *  Defaults to 'start'. Only honoured in paginated layout. */
  initialSubPagePosition?: AdjacentDocPosition;
  /** Bookmark ribbon state + toggle (Proposal 03). Omitted = ribbon hidden. */
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export function BookPage({
  document,
  chapterLabel,
  docIndex,
  docCount,
  onPrevDoc,
  onNextDoc,
  onGoUpLevel,
  showInlineReferences,
  layout,
  onLayoutChange,
  initialSubPagePosition = 'start',
  bookmarked = false,
  onToggleBookmark,
}: BookPageProps) {
  // Sub-page state lives here so the footer can display and control it.
  const [subPage, setSubPage] = useState(0);
  const [subPageCount, setSubPageCount] = useState(1);
  // When navigating via Prev-at-start → previous doc's last sub-page, we
  // don't know the count yet. Capture the intent and apply it once columns
  // have been measured and subPageCount is current.
  const pendingPosition = useRef<AdjacentDocPosition | null>(initialSubPagePosition);

  // Reset sub-page state on doc change. `initialSubPagePosition` informs
  // where to land once columns are known.
  useEffect(() => {
    pendingPosition.current = initialSubPagePosition;
    setSubPage(0);
    setSubPageCount(1);
  }, [document.id, initialSubPagePosition]);

  // When subPageCount updates, realize any pending "end" position. Also
  // clamp subPage when the count shrinks (e.g. after a window resize that
  // now fits fewer columns).
  useEffect(() => {
    if (pendingPosition.current === 'end' && subPageCount > 1) {
      setSubPage(subPageCount - 1);
      pendingPosition.current = null;
    } else if (pendingPosition.current === 'start') {
      pendingPosition.current = null;
    }
    setSubPage((p) => (p > subPageCount - 1 ? Math.max(0, subPageCount - 1) : p));
  }, [subPageCount]);

  const isPaginated = layout === 'paginated';

  const canPrevSubPage = isPaginated && subPage > 0;
  const canNextSubPage = isPaginated && subPage < subPageCount - 1;

  const handlePrev = () => {
    if (canPrevSubPage) {
      setSubPage((p) => p - 1);
    } else if (onPrevDoc) {
      // Cross-doc boundary: parent decides whether to prompt or navigate.
      onPrevDoc(isPaginated ? 'end' : 'start');
    } else if (onGoUpLevel) {
      // No more docs to go back to — walk the folder path up one level.
      onGoUpLevel();
    }
  };
  const handleNext = () => {
    if (canNextSubPage) {
      setSubPage((p) => p + 1);
    } else if (onNextDoc) {
      onNextDoc('start');
    }
  };

  // Disabled when there's nothing left in either direction.
  const prevDisabled = !canPrevSubPage && !onPrevDoc && !onGoUpLevel;
  const nextDisabled = !canNextSubPage && !onNextDoc;

  const docCounter = `Doc ${toRomanNumeral(docIndex + 1)} of ${toRomanNumeral(docCount)}`;
  const footerLabel = isPaginated && subPageCount > 1
    ? `Page ${toRomanNumeral(subPage + 1)} of ${toRomanNumeral(subPageCount)} · ${docCounter}`
    : docCounter;

  return (
    <article className={'book-page' + (isPaginated ? ' book-page--paginated' : ' book-page--continuous')} key={document.id}>
      <LayoutToggle layout={layout} onChange={onLayoutChange} />

      {/* Bookmark ribbon — top-left of the paper (the layout toggle owns the
       *  top-right corner). Anchored to the article so it stays visible on
       *  every sub-page. */}
      {onToggleBookmark && (
        <button
          type="button"
          className={
            'book-page__bookmark' + (bookmarked ? ' book-page__bookmark--set' : '')
          }
          onClick={onToggleBookmark}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          aria-pressed={bookmarked}
        >
          <span className="book-page__bookmark-ribbon" aria-hidden="true" />
        </button>
      )}

      {/* Title block only on the opening page. In paginated mode, sub-pages
       *  past the first hide the header so the body fills the paper —
       *  matches how a printed book drops the chapter title on continuation
       *  pages. PaginatedBody re-measures via ResizeObserver when the
       *  viewport grows, so column count adjusts automatically. */}
      {(!isPaginated || subPage === 0) && (
        <header className="book-page__header">
          {chapterLabel && (
            <div className="book-page__eyebrow">{chapterLabel}</div>
          )}
          <div className="book-page__rule" aria-hidden="true" />
          <h1 className="book-page__title">{document.title}</h1>
          <div className="book-page__fleuron" aria-hidden="true">&#10086;</div>
        </header>
      )}

      {isPaginated ? (
        <PaginatedBody
          content={document.content}
          currentPage={subPage}
          onColumnCountChange={setSubPageCount}
        />
      ) : (
        <div className="book-page__body">
          <TipTapEditor
            content={document.content}
            editable={false}
            onUpdate={noop}
          />
        </div>
      )}

      {/* Inline refs only in continuous mode + narrow viewport. In paginated
       *  mode, mixing refs into the columnar flow creates confusing layout. */}
      {!isPaginated && showInlineReferences && (
        <div className="book-page__inline-refs">
          <h3 className="book-page__inline-refs-title">References</h3>
          <BookReferencesRail documentId={document.id} variant="inline" />
        </div>
      )}

      <footer className="book-page__footer">
        <button
          type="button"
          className="book-page__footer-nav"
          onClick={handlePrev}
          disabled={prevDisabled}
        >
          <svg viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M9 4H1M1 4l3-3M1 4l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Previous
        </button>
        <span className="book-page__footer-number">{footerLabel}</span>
        <button
          type="button"
          className="book-page__footer-nav"
          onClick={handleNext}
          disabled={nextDisabled}
        >
          Next
          <svg viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4h8M9 4l-3-3M9 4l-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </footer>
    </article>
  );
}

function noop() {
  /* Read-only: TipTap still requires an onUpdate prop. */
}

export function BookPageEmpty({
  message,
  layout,
  onLayoutChange,
}: {
  message: string;
  layout: ReaderLayout;
  onLayoutChange: (layout: ReaderLayout) => void;
}) {
  return (
    <article className="book-page book-page--empty">
      <LayoutToggle layout={layout} onChange={onLayoutChange} />
      <div className="book-page__fleuron" aria-hidden="true">&#10086;</div>
      <div className="book-page--empty-title">Nothing to read</div>
      <div className="book-page--empty-body">{message}</div>
    </article>
  );
}
