interface StackTileProps {
  /** Heading shown on the topmost sheet. e.g. "Loose Pages" or "Foreword". */
  title: string;
  /** How many docs are in this stack. Drives the "N pages" subtitle and the
   *  number of paper layers drawn underneath (clamped to [1, 3]). */
  count: number;
  onOpen: () => void;
}

/** A collapsed representation of several loose documents at the same level.
 *  Visually: 2–3 overlapping paper cards fanned slightly — communicates
 *  "there are several pages here" without using a grid slot per doc.
 *
 *  Clicking drills into the stack; the parent appends `STACK_SEGMENT` to
 *  the active folder path and re-renders the same siblings as individual
 *  PageTiles. */
export function StackTile({ title, count, onOpen }: StackTileProps) {
  const layers = Math.max(1, Math.min(3, count));
  const countLabel = count === 1 ? '1 page' : `${count} pages`;

  return (
    <button type="button" className="stack-tile" onClick={onOpen} title={`${title} — ${countLabel}`}>
      <div className="stack-tile__stack">
        {layers >= 3 && <div className="stack-tile__sheet stack-tile__sheet--back" aria-hidden="true" />}
        {layers >= 2 && <div className="stack-tile__sheet stack-tile__sheet--mid" aria-hidden="true" />}
        <div className="stack-tile__sheet stack-tile__sheet--front">
          <div className="stack-tile__rule" aria-hidden="true" />
          <div className="stack-tile__title">{title}</div>
          <div className="stack-tile__count">{countLabel}</div>
        </div>
      </div>
    </button>
  );
}
