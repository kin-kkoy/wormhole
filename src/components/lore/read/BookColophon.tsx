import { useMemo, useState } from 'react';
import type { LoreDocumentSummary } from '../../../lib/commands';

interface BookColophonProps {
  bookTitle: string;
  /** The book's final document in reading order — owns the next_page_link. */
  lastDocId: string;
  /** Resolved next_page_link target for the last doc, if one is set. */
  continueTarget: LoreDocumentSummary | null;
  /** All documents world-wide, for the "choose another volume" picker. */
  documents: LoreDocumentSummary[];
  onContinue: (targetId: string) => void;
  /** Persist a new next_page_link target for the last doc. */
  onChooseVolume: (target: LoreDocumentSummary) => void;
  onBack: () => void;
  onReturnToLibrary: () => void;
}

const PICKER_CAP = 50;

/**
 * The end-of-book colophon page. Replaces the dead end past the last
 * document: "Here ends <book>", a continue card honoring the last doc's
 * next_page_link override, a picker to set that override in place, and a
 * route back to the library. This page IS the end-of-book confirmation
 * gate — clicking the named continue card navigates without a second popup
 * (mid-book boundaries keep the confirm popup).
 */
export function BookColophon({
  bookTitle,
  lastDocId,
  continueTarget,
  documents,
  onContinue,
  onChooseVolume,
  onBack,
  onReturnToLibrary,
}: BookColophonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Locally picked target so the continue card updates instantly, before
  // the nextPageMap refetch lands.
  const [picked, setPicked] = useState<LoreDocumentSummary | null>(null);

  const target = picked ?? continueTarget;

  const pickerDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((d) => d.id !== lastDocId)
      .filter((d) => (q ? d.title.toLowerCase().includes(q) : true))
      .slice(0, PICKER_CAP);
  }, [documents, lastDocId, query]);

  function handlePick(doc: LoreDocumentSummary) {
    setPicked(doc);
    setPickerOpen(false);
    setQuery('');
    onChooseVolume(doc);
  }

  return (
    <article className="book-page book-colophon">
      <header className="book-page__header">
        <div className="book-page__eyebrow">Here ends</div>
        <div className="book-page__rule" aria-hidden="true" />
        <h1 className="book-page__title">{bookTitle}</h1>
        <div className="book-page__fleuron" aria-hidden="true">
          ❦
        </div>
      </header>

      <div className="book-colophon__body">
        {target ? (
          <button
            type="button"
            className="book-colophon__card"
            onClick={() => onContinue(target.id)}
          >
            <span className="book-colophon__card-eyebrow">The tale continues in</span>
            <span className="book-colophon__card-title">{target.title}</span>
            <span className="book-colophon__card-go">Continue →</span>
          </button>
        ) : (
          <p className="book-colophon__rest">
            The tale rests here — no further volume has been bound to this one.
          </p>
        )}

        <div className="book-colophon__choose">
          {!pickerOpen ? (
            <button
              type="button"
              className="book-colophon__link-btn"
              onClick={() => setPickerOpen(true)}
            >
              Choose another volume…
            </button>
          ) : (
            <div className="book-colophon__picker">
              <input
                autoFocus
                type="text"
                className="book-colophon__picker-search"
                placeholder="Search all documents…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPickerOpen(false);
                    setQuery('');
                  }
                }}
              />
              <div className="book-colophon__picker-list">
                {pickerDocs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className="book-colophon__picker-item"
                    onClick={() => handlePick(d)}
                  >
                    {d.title}
                  </button>
                ))}
                {pickerDocs.length === 0 && (
                  <div className="book-colophon__picker-empty">No documents match.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="book-colophon__link-btn book-colophon__library"
          onClick={onReturnToLibrary}
        >
          Return to the library
        </button>
      </div>

      <footer className="book-page__footer">
        <button type="button" className="book-page__footer-nav" onClick={onBack}>
          <svg viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path
              d="M9 4H1M1 4l3-3M1 4l3 3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to the last page
        </button>
        <span className="book-page__footer-number">· colophon ·</span>
        {/* Disabled twin keeps the footer balanced AND keeps the ArrowRight
         *  keyboard shortcut (which clicks `.book-page__footer-nav:last-of-type`)
         *  from re-triggering the Back button. */}
        <button
          type="button"
          className="book-page__footer-nav book-colophon__footer-spacer"
          disabled
          aria-hidden="true"
        >
          Next
          <svg viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path
              d="M1 4h8M9 4l-3-3M9 4l-3 3"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </footer>
    </article>
  );
}
