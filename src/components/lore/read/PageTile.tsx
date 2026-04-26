import type { LoreDocumentSummary } from '../../../lib/commands';

interface PageTileProps {
  document: LoreDocumentSummary;
  onOpen: (docId: string) => void;
}

/** Folded-corner document card. Intentionally smaller and visually distinct
 *  from a BookCover so the reader can tell at a glance which tiles drill
 *  further (books) and which tiles open into the reader (pages). */
export function PageTile({ document, onOpen }: PageTileProps) {
  return (
    <button
      type="button"
      className="page-tile"
      onClick={() => onOpen(document.id)}
      title={document.title}
    >
      <div className="page-tile__card">
        {/* Folded corner — drawn with two overlapping triangles via clip-path */}
        <div className="page-tile__corner" aria-hidden="true" />
        <div className="page-tile__lines" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div className="page-tile__title">{document.title}</div>
      </div>
    </button>
  );
}
