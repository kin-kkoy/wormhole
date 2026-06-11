import type { ReaderLayout } from '../../../state/store';

interface LayoutToggleProps {
  layout: ReaderLayout;
  onChange: (layout: ReaderLayout) => void;
}

/** Paginated ↔ continuous switch on the paper's upper-right corner.
 *  A labeled two-segment control — the old single icon-button's glyphs
 *  didn't read as anything at 14px (Logs To Fix). */
export function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  return (
    <div className="book-page__layout-toggle" role="group" aria-label="Reading layout">
      <button
        type="button"
        className={`book-page__layout-toggle-seg${
          layout === 'paginated' ? ' book-page__layout-toggle-seg--active' : ''
        }`}
        onClick={() => onChange('paginated')}
        aria-pressed={layout === 'paginated'}
        title="Pages — turn like a book"
      >
        {/* Dog-eared page */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4" />
          <path d="M9 12h7M9 16h7" />
        </svg>
        Pages
      </button>
      <button
        type="button"
        className={`book-page__layout-toggle-seg${
          layout === 'continuous' ? ' book-page__layout-toggle-seg--active' : ''
        }`}
        onClick={() => onChange('continuous')}
        aria-pressed={layout === 'continuous'}
        title="Scroll — one long paper"
      >
        {/* Unrolling scroll */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M7 4c-1.7 0-3 1.3-3 3s1.3 3 3 3h10c1.7 0 3 1.3 3 3s-1.3 3-3 3H7" />
          <path d="M7 20h10" />
        </svg>
        Scroll
      </button>
    </div>
  );
}
