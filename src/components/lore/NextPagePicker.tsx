import { useEffect, useMemo, useRef, useState } from 'react';
import { commands } from '../../lib/commands';
import type { LoreDocumentSummary } from '../../lib/commands';

interface NextPagePickerProps {
  documentId: string;
  /** Bumped whenever the parent knows the underlying link may have changed
   *  (e.g. after LinkedRecordsPanel deletes a row). Forces a re-fetch. */
  refreshToken?: number;
  onChanged?: () => void;
}

/** Thin "Continue to…" bar rendered under the document editor toolbar. Owns
 *  its own state (target + popover) so the toolbar can stay shallow. */
export function NextPagePicker({ documentId, refreshToken, onChanged }: NextPagePickerProps) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [allDocs, setAllDocs] = useState<LoreDocumentSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Load the current override + the world's doc list on mount / doc change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tid, docs] = await Promise.all([
          commands.getNextPageLink(documentId),
          commands.listLoreDocuments(),
        ]);
        if (cancelled) return;
        setTargetId(tid);
        setAllDocs(docs);
      } catch (e) {
        console.error('Failed to load next-page data:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentId, refreshToken]);

  // Dismiss popover on outside click / Esc.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentTarget = useMemo(
    () => allDocs.find((d) => d.id === targetId) ?? null,
    [allDocs, targetId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = allDocs.filter((d) => d.id !== documentId);
    if (!q) return pool.slice(0, 50);
    return pool
      .filter((d) => d.title.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allDocs, documentId, query]);

  async function handlePick(id: string | null) {
    if (saving) return;
    setSaving(true);
    try {
      await commands.setNextPageLink({ documentId, targetId: id });
      setTargetId(id);
      setOpen(false);
      setQuery('');
      onChanged?.();
    } catch (e) {
      console.error('Failed to set next page:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="doc-editor__next-inline" ref={rootRef}>
      <span className="doc-editor__next-label">Continue to:</span>
      <button
        type="button"
        className="doc-editor__next-picker"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        title={currentTarget ? `Currently set to: ${currentTarget.title}` : 'Pick a document'}
      >
        <span className="doc-editor__next-picker-text">
          {currentTarget?.title ?? <em>Not set — continues in reading order</em>}
        </span>
        <span className="doc-editor__next-picker-caret" aria-hidden="true">▾</span>
      </button>
      {currentTarget && (
        <button
          type="button"
          className="doc-editor__next-clear"
          onClick={() => handlePick(null)}
          disabled={saving}
          title="Clear override"
        >
          Clear
        </button>
      )}

      {open && (
        <div className="doc-editor__next-popover" role="dialog">
          <input
            type="text"
            className="doc-editor__next-search"
            placeholder="Search documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className="doc-editor__next-list">
            {filtered.length === 0 ? (
              <div className="doc-editor__next-empty">
                {allDocs.length <= 1
                  ? 'No other documents to link to.'
                  : 'No matches.'}
              </div>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={
                    'doc-editor__next-option' +
                    (d.id === targetId ? ' doc-editor__next-option--current' : '')
                  }
                  onClick={() => handlePick(d.id)}
                  disabled={saving}
                >
                  {d.title}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
