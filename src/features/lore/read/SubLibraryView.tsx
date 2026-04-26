import type { LoreFolder, LoreDocumentSummary } from '../../../lib/commands';
import { BookCover } from '../../../components/lore/read/BookCover';
import { PageTile } from '../../../components/lore/read/PageTile';
import { StackTile } from '../../../components/lore/read/StackTile';
import {
  buildBookTree,
  listFolderChildren,
} from '../../../components/lore/read/bookOrder';

interface SubLibraryViewProps {
  /** The folder being viewed. Its children become the tile grid. */
  folder: LoreFolder;
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
  /** Depth of this folder in the drill-down path. Depth 1 = book root
   *  (docs at this level become a StackTile). Depth 2+ = docs render as
   *  individual PageTiles. */
  depth: number;
  onOpenSubFolder: (folderId: string) => void;
  onOpenDocument: (docId: string) => void;
  onExpandStack: () => void;
}

/** Mixed grid of sub-folder book covers and documents. Used when a folder
 *  has sub-folders — this replaces the reader as the primary view at that
 *  level. */
export function SubLibraryView({
  folder,
  folders,
  documents,
  depth,
  onOpenSubFolder,
  onOpenDocument,
  onExpandStack,
}: SubLibraryViewProps) {
  const { subFolders, docs } = listFolderChildren(folder.id, folders, documents);

  // At depth 1 (immediate children of a book root), docs collapse into a
  // single StackTile. At depth 2+ they show individually, mixed with the
  // sub-folder tiles.
  const stackDocs = depth === 1 && docs.length > 0;

  return (
    <div className="library-shelf library-shelf--sub">
      <h2 className="library-shelf__title">{folder.title}</h2>
      <p className="library-shelf__subtitle">
        {describeContents(subFolders.length, docs.length)}
      </p>
      <div className="library-shelf__grid">
        {subFolders.map((sub) => {
          const subTree = buildBookTree(sub.id, folders, documents);
          if (!subTree) return null;
          return (
            <BookCover
              key={sub.id}
              book={subTree}
              onOpen={() => onOpenSubFolder(sub.id)}
            />
          );
        })}

        {stackDocs && (
          <StackTile
            title={docs.length === 1 ? docs[0].title : 'Loose Pages'}
            count={docs.length}
            onOpen={onExpandStack}
          />
        )}

        {!stackDocs &&
          docs.map((doc) => (
            <PageTile key={doc.id} document={doc} onOpen={onOpenDocument} />
          ))}
      </div>
    </div>
  );
}

function describeContents(bookCount: number, docCount: number): string {
  const parts: string[] = [];
  if (bookCount > 0) parts.push(bookCount === 1 ? '1 book' : `${bookCount} books`);
  if (docCount > 0) parts.push(docCount === 1 ? '1 page' : `${docCount} pages`);
  if (parts.length === 0) return 'Empty';
  return parts.join(' · ');
}

interface ExpandedStackViewProps {
  /** The parent folder whose direct docs were stacked. */
  folder: LoreFolder;
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
  onOpenDocument: (docId: string) => void;
}

/** Renders the expanded contents of a stack: each previously-stacked doc
 *  shown as its own PageTile. Reached by pushing `STACK_SEGMENT` onto the
 *  active path. */
export function ExpandedStackView({
  folder,
  folders,
  documents,
  onOpenDocument,
}: ExpandedStackViewProps) {
  const { docs } = listFolderChildren(folder.id, folders, documents);
  return (
    <div className="library-shelf library-shelf--sub">
      <h2 className="library-shelf__title">{folder.title} · Loose Pages</h2>
      <p className="library-shelf__subtitle">
        {docs.length === 1 ? '1 page' : `${docs.length} pages`}
      </p>
      <div className="library-shelf__grid">
        {docs.map((doc) => (
          <PageTile key={doc.id} document={doc} onOpen={onOpenDocument} />
        ))}
      </div>
    </div>
  );
}

/** Expanded view for the world-root Loose Pages stack (docs with
 *  folder_id = null). Same layout, different title. */
export function LooseStackView({
  documents,
  onOpenDocument,
}: {
  documents: LoreDocumentSummary[];
  onOpenDocument: (docId: string) => void;
}) {
  const looseDocs = documents
    .filter((d) => d.folder_id === null)
    .sort((a, b) => a.title.localeCompare(b.title));
  return (
    <div className="library-shelf library-shelf--sub">
      <h2 className="library-shelf__title">Loose Pages</h2>
      <p className="library-shelf__subtitle">
        {looseDocs.length === 1 ? '1 page' : `${looseDocs.length} pages`} unfiled
      </p>
      <div className="library-shelf__grid">
        {looseDocs.map((doc) => (
          <PageTile key={doc.id} document={doc} onOpen={onOpenDocument} />
        ))}
      </div>
    </div>
  );
}
