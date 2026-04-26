import { useEffect, useMemo, useState } from 'react';
import type { LoreDocumentSummary } from '../../../lib/commands';
import type { BookNode, ChapterNode } from './bookOrder';

interface BookTableOfContentsProps {
  book: BookNode;
  selectedDocumentId: string | null;
  onSelectDocument: (id: string) => void;
}

/** Collect every folder id on the path from the book root down to the folder
 *  containing the given doc (inclusive). Used to auto-expand the TOC when the
 *  selected document changes (e.g. from Prev/Next or cross-book linking). */
function collectAncestorFolderIds(book: BookNode, docId: string): string[] {
  const result: string[] = [];
  function walk(chapter: ChapterNode, trail: string[]): boolean {
    const nextTrail = [...trail, chapter.folder.id];
    if (chapter.docs.some((d) => d.id === docId)) {
      result.push(...nextTrail);
      return true;
    }
    for (const p of chapter.pockets) {
      if (walk(p, nextTrail)) return true;
    }
    return false;
  }
  for (const c of book.chapters) {
    if (walk(c, [])) break;
  }
  return result;
}

export function BookTableOfContents({
  book,
  selectedDocumentId,
  onSelectDocument,
}: BookTableOfContentsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Auto-expand the ancestor path when the current document changes.
  useEffect(() => {
    if (!selectedDocumentId) return;
    const ancestors = collectAncestorFolderIds(book, selectedDocumentId);
    if (ancestors.length === 0) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ancestors) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [book, selectedDocumentId]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasAnything = useMemo(
    () => book.looseDocs.length > 0 || book.chapters.length > 0,
    [book],
  );

  if (!hasAnything) {
    return (
      <div>
        <div className="book-toc__book-title" title={book.title}>
          {book.title}
        </div>
        <div className="book-toc__empty">This book is empty. Switch to Write to add chapters and pages.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="book-toc__book-title" title={book.title}>
        {book.title}
      </div>

      {book.looseDocs.length > 0 && (
        <ForewordSection
          docs={book.looseDocs}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={onSelectDocument}
        />
      )}

      {book.chapters.map((chapter) => (
        <ChapterSection
          key={chapter.folder.id}
          chapter={chapter}
          expanded={expanded}
          toggle={toggle}
          selectedDocumentId={selectedDocumentId}
          onSelectDocument={onSelectDocument}
        />
      ))}
    </div>
  );
}

function ForewordSection({
  docs,
  selectedDocumentId,
  onSelectDocument,
}: {
  docs: LoreDocumentSummary[];
  selectedDocumentId: string | null;
  onSelectDocument: (id: string) => void;
}) {
  return (
    <div className="book-toc__section">
      <div className="book-toc__chapter book-toc__chapter--foreword" style={{ cursor: 'default' }}>
        <span className="book-toc__chapter-label">Foreword</span>
      </div>
      <div className="book-toc__children">
        {docs.map((doc) => (
          <PageEntry
            key={doc.id}
            doc={doc}
            depth={0}
            active={doc.id === selectedDocumentId}
            onSelect={onSelectDocument}
          />
        ))}
      </div>
    </div>
  );
}

function ChapterSection({
  chapter,
  expanded,
  toggle,
  selectedDocumentId,
  onSelectDocument,
}: {
  chapter: ChapterNode;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedDocumentId: string | null;
  onSelectDocument: (id: string) => void;
}) {
  const isEmpty = chapter.docs.length === 0 && chapter.pockets.length === 0;
  const isOpen = expanded.has(chapter.folder.id);

  if (isEmpty) {
    return (
      <div className="book-toc__section">
        <div
          className="book-toc__chapter book-toc__chapter--empty"
          title={`${chapter.folder.title} — empty chapter`}
        >
          <span className="book-toc__chapter-fleuron" aria-hidden="true">&#10086;</span>
          <span className="book-toc__chapter-label">{chapter.folder.title}</span>
          <span className="book-toc__empty-hint">empty</span>
        </div>
      </div>
    );
  }

  return (
    <div className="book-toc__section">
      <button
        type="button"
        className={
          'book-toc__chapter' + (isOpen ? ' book-toc__chapter--expanded' : '')
        }
        onClick={() => toggle(chapter.folder.id)}
        title={chapter.folder.title}
      >
        <span className="book-toc__chapter-fleuron" aria-hidden="true">&#10086;</span>
        <span className="book-toc__chapter-label">{chapter.folder.title}</span>
      </button>
      {isOpen && (
        <div className="book-toc__children">
          {chapter.docs.map((doc) => (
            <PageEntry
              key={doc.id}
              doc={doc}
              depth={1}
              active={doc.id === selectedDocumentId}
              onSelect={onSelectDocument}
            />
          ))}
          {chapter.pockets.map((p) => (
            <PocketEntry
              key={p.folder.id}
              chapter={p}
              expanded={expanded}
              toggle={toggle}
              selectedDocumentId={selectedDocumentId}
              onSelectDocument={onSelectDocument}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PocketEntry({
  chapter,
  expanded,
  toggle,
  selectedDocumentId,
  onSelectDocument,
}: {
  chapter: ChapterNode;
  expanded: Set<string>;
  toggle: (id: string) => void;
  selectedDocumentId: string | null;
  onSelectDocument: (id: string) => void;
}) {
  const isOpen = expanded.has(chapter.folder.id);
  const depth = chapter.depth;
  const isEmpty = chapter.docs.length === 0 && chapter.pockets.length === 0;

  if (isEmpty) {
    return (
      <button
        type="button"
        className="book-toc__pocket"
        style={{ ['--pocket-depth' as string]: String(depth) }}
        disabled
        title={`${chapter.folder.title} — empty pocket`}
      >
        <span className="book-toc__pocket-fleuron" aria-hidden="true">&#10086;</span>
        <span className="book-toc__pocket-label">{chapter.folder.title}</span>
        <span className="book-toc__empty-hint">empty</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        className={
          'book-toc__pocket' + (isOpen ? ' book-toc__pocket--expanded' : '')
        }
        style={{ ['--pocket-depth' as string]: String(depth) }}
        onClick={() => toggle(chapter.folder.id)}
        title={chapter.folder.title}
      >
        <span className="book-toc__pocket-fleuron" aria-hidden="true">&#10086;</span>
        <span className="book-toc__pocket-label">{chapter.folder.title}</span>
      </button>
      {isOpen && (
        <>
          {chapter.docs.map((doc) => (
            <PageEntry
              key={doc.id}
              doc={doc}
              depth={depth + 1}
              active={doc.id === selectedDocumentId}
              onSelect={onSelectDocument}
            />
          ))}
          {chapter.pockets.map((p) => (
            <PocketEntry
              key={p.folder.id}
              chapter={p}
              expanded={expanded}
              toggle={toggle}
              selectedDocumentId={selectedDocumentId}
              onSelectDocument={onSelectDocument}
            />
          ))}
        </>
      )}
    </>
  );
}

function PageEntry({
  doc,
  depth,
  active,
  onSelect,
}: {
  doc: LoreDocumentSummary;
  depth: number;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={'book-toc__page' + (active ? ' book-toc__page--active' : '')}
      style={{ ['--page-depth' as string]: String(depth) }}
      onClick={() => onSelect(doc.id)}
      title={doc.title}
    >
      <svg className="book-toc__page-icon" viewBox="0 0 12 14" fill="none" aria-hidden="true">
        <path
          d="M2 1h6l2 2v10H2V1z"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path d="M8 1v2h2" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <span className="book-toc__page-label">{doc.title}</span>
    </button>
  );
}
