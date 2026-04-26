import { getSpineColor } from './bookOrder';
import type { BookNode } from './bookOrder';
import { LOOSE_BOOK_ID } from '../../../state/store';
import { countChapters, countPages } from './bookOrder';

interface BookCoverProps {
  book: BookNode;
  onOpen: (bookId: string) => void;
}

export function BookCover({ book, onOpen }: BookCoverProps) {
  const isLoose = book.id === LOOSE_BOOK_ID;
  const spineColor = getSpineColor(book.id);
  const chapters = countChapters(book);
  const pages = countPages(book);

  const chapterLabel = chapters === 1 ? '1 chapter' : `${chapters} chapters`;
  const pageLabel = pages === 1 ? '1 page' : `${pages} pages`;
  const metaLine = isLoose || chapters === 0 ? pageLabel : `${chapterLabel} · ${pageLabel}`;

  return (
    <button
      type="button"
      className={'book-cover' + (isLoose ? ' book-cover--loose' : '')}
      style={{ ['--spine-color' as string]: spineColor }}
      onClick={() => onOpen(book.id)}
      title={book.title}
    >
      <div className="book-cover__tile">
        <div className="book-cover__spine" aria-hidden="true" />
        <div className="book-cover__face">
          <div>
            <div className="book-cover__rule" aria-hidden="true" />
            <div className="book-cover__title">{book.title}</div>
          </div>
          <div className="book-cover__meta">
            <span>{metaLine}</span>
          </div>
        </div>
      </div>
      {isLoose && (
        <span className="book-cover__label">
          Pages that haven&apos;t been filed into a book yet.
        </span>
      )}
    </button>
  );
}
