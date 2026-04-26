import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TipTapEditor } from '../../editor/TipTapEditor';

interface PaginatedBodyProps {
  /** TipTap JSON content (already stringified). */
  content: string;
  /** Zero-based sub-page index to display. Parent owns this state so the
   *  footer can show/control it. */
  currentPage: number;
  /** Fired whenever the column count changes (after a resize / content
   *  change). Parent uses this to clamp `currentPage` and update the
   *  "Page X of Y" footer. */
  onColumnCountChange: (count: number) => void;
}

/** Renders the document body inside a horizontally-paged CSS-columns layout.
 *
 *  Key idea: one HTML column = one "sub-page" of the document. The browser
 *  flows TipTap content across as many columns as needed to hold it all.
 *  We clip the viewport to exactly one column's width and translate the
 *  columns container left by `currentPage * columnWidth` to reveal the
 *  active sub-page.
 *
 *  Re-measure on resize: when the viewport changes width/height, column
 *  layout changes, which changes total column count. A ResizeObserver
 *  triggers re-measurement.
 */
export function PaginatedBody({
  content,
  currentPage,
  onColumnCountChange,
}: PaginatedBodyProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [columnWidth, setColumnWidth] = useState(0);

  /** Snapshot the viewport size and recompute the column count. Runs after
   *  layout (useLayoutEffect) so the DOM is already measured. */
  const remeasure = () => {
    const viewport = viewportRef.current;
    const columns = columnsRef.current;
    if (!viewport || !columns) return;
    const w = viewport.clientWidth;
    if (w <= 0) return;
    setColumnWidth(w);
    // Apply column-width imperatively so the browser reflows BEFORE we
    // measure scrollWidth. Without this, setState is async and the first
    // RAF sees stale column-width, leaving the sub-page count stuck.
    columns.style.columnWidth = `${w}px`;
    // scrollWidth reflects the full width of columnar content — e.g. 4
    // columns of 680px content = scrollWidth 2720px. Dividing by column
    // width (one viewport worth) gives the number of sub-pages.
    requestAnimationFrame(() => {
      const c = columnsRef.current;
      if (!c) return;
      const sw = c.scrollWidth;
      const count = Math.max(1, Math.ceil(sw / Math.max(w, 1)));
      onColumnCountChange(count);
    });
  };

  useLayoutEffect(() => {
    remeasure();
    if (!viewportRef.current) return;
    const observer = new ResizeObserver(() => remeasure());
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Content changes (new document) → re-measure after TipTap re-renders.
  useEffect(() => {
    // Defer to let TipTap paint the new content first.
    const id = requestAnimationFrame(() => remeasure());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div className="book-page__viewport" ref={viewportRef}>
      <div
        ref={columnsRef}
        className="book-page__columns"
        style={{
          // column-width = one viewport width → one column per sub-page.
          columnWidth: columnWidth > 0 ? `${columnWidth}px` : undefined,
          transform: `translateX(${-currentPage * columnWidth}px)`,
        }}
      >
        <TipTapEditor content={content} editable={false} onUpdate={noop} />
      </div>
    </div>
  );
}

function noop() {
  /* Read-only: TipTap still requires an onUpdate prop. */
}
