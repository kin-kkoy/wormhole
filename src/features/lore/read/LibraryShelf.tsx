import type { LoreFolder, LoreDocumentSummary } from '../../../lib/commands';
import { BookCover } from '../../../components/lore/read/BookCover';
import { StackTile } from '../../../components/lore/read/StackTile';
import {
  buildBookTree,
  hasLooseDocs,
  listRootFolders,
} from '../../../components/lore/read/bookOrder';
import type { BookNode } from '../../../components/lore/read/bookOrder';

interface LibraryShelfProps {
  folders: LoreFolder[];
  documents: LoreDocumentSummary[];
  onOpenBook: (bookId: string) => void;
  onOpenLooseStack: () => void;
  onSwitchToWrite: () => void;
}

export function LibraryShelf({
  folders,
  documents,
  onOpenBook,
  onOpenLooseStack,
  onSwitchToWrite,
}: LibraryShelfProps) {
  const roots = listRootFolders(folders);
  const includeLoose = hasLooseDocs(documents);
  const looseCount = includeLoose ? documents.filter((d) => d.folder_id === null).length : 0;

  const books: BookNode[] = [];
  for (const r of roots) {
    const book = buildBookTree(r.id, folders, documents);
    if (book) books.push(book);
  }

  if (books.length === 0 && !includeLoose) {
    return (
      <div className="library-shelf">
        <div className="library-shelf__empty">
          <div className="library-shelf__empty-fleuron" aria-hidden="true">
            &#10086;
          </div>
          <div className="library-shelf__empty-title">No books yet</div>
          <div className="library-shelf__empty-body">
            Your library will fill with volumes as you write. Switch to Write mode to
            create your first root folder — that becomes a book.
          </div>
          <button
            type="button"
            className="library-shelf__empty-cta"
            onClick={onSwitchToWrite}
          >
            Start Writing
          </button>
        </div>
      </div>
    );
  }

  const volumeCount = books.length + (includeLoose ? 1 : 0);

  return (
    <div className="library-shelf">
      <h2 className="library-shelf__title">Library</h2>
      <p className="library-shelf__subtitle">
        {volumeCount === 1 ? '1 volume' : `${volumeCount} volumes`} in your archive
      </p>
      <div className="library-shelf__grid">
        {books.map((book) => (
          <BookCover key={book.id} book={book} onOpen={onOpenBook} />
        ))}
        {includeLoose && (
          <StackTile
            title="Loose Pages"
            count={looseCount}
            onOpen={onOpenLooseStack}
          />
        )}
      </div>
    </div>
  );
}
