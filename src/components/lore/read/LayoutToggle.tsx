import type { ReaderLayout } from '../../../state/store';

interface LayoutToggleProps {
  layout: ReaderLayout;
  onChange: (layout: ReaderLayout) => void;
}

/** Small icon button anchored to the upper-right of the paper. One click
 *  swaps between paginated (sub-pages) and continuous (infinite scroll)
 *  reading layouts. The shown icon represents the CURRENT mode, and the
 *  tooltip announces the ACTION (what pressing it will do). */
export function LayoutToggle({ layout, onChange }: LayoutToggleProps) {
  const nextLayout: ReaderLayout = layout === 'paginated' ? 'continuous' : 'paginated';
  const tooltip =
    layout === 'paginated' ? 'Switch to infinite scroll' : 'Switch to page view';

  return (
    <button
      type="button"
      className="book-page__layout-toggle"
      onClick={() => onChange(nextLayout)}
      title={tooltip}
      aria-label={tooltip}
    >
      {layout === 'paginated' ? (
        /* Paginated: open-book icon — two facing pages with a center spine. */
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M2.5 4.2c1.6-.5 3.6-.6 5 0 .5.2.5.4.5.8v8.4c0 .4-.2.5-.6.4-1.4-.5-3.3-.4-4.9.1V4.2Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 4.2c-1.6-.5-3.6-.6-5 0-.5.2-.5.4-.5.8v8.4c0 .4.2.5.6.4 1.4-.5 3.3-.4 4.9.1V4.2Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="M9 5.2v8.6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        </svg>
      ) : (
        /* Continuous: scroll icon — rolled paper with top + bottom curls. */
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M5 3.5h7.5c.8 0 1.5.7 1.5 1.5v.6c0 .5-.4.9-.9.9H10"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path
            d="M4 3.5c-.9 0-1.6.8-1.6 1.7v.4c0 .5.4.9.9.9H6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path d="M5 6.5v6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M13 6.5v6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path
            d="M5 13c0 .9.7 1.6 1.6 1.6h7.4c.5 0 .9-.4.9-.9v-.5c0-.5-.4-.9-.9-.9H8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <path d="M7.5 8.5h3M7.5 10.5h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
        </svg>
      )}
    </button>
  );
}
