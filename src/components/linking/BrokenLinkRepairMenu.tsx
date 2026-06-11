import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import { commands } from '../../lib/commands';
import type { LinkableRecord } from '../../lib/commands';
import { findEditorForElement } from './editorRegistry';
import { invalidateBrokenLinks } from './useBrokenLinkResolver';
import { binStatusLine } from '../../lib/recycleTime';
import './BrokenLinkRepairMenu.css';

interface RepairTarget {
  element: HTMLElement;
  entityType: 'character' | 'lore_document';
  entityId: string;
  label: string;
  rect: DOMRect;
}

type BinState =
  | { kind: 'loading' }
  | { kind: 'in-bin'; deletedAt: string }
  | { kind: 'purged' };

/** Locate the inlineLink atom node that the clicked span renders. posAtDOM
 *  conventions for atom leaves vary ("before" vs "inside"), so probe both
 *  and verify the entity id before trusting the position. */
function findLinkNode(editor: Editor, target: RepairTarget): { pos: number; nodeSize: number; label: string } | null {
  const { view } = editor;
  let pos: number;
  try {
    pos = view.posAtDOM(target.element, 0);
  } catch {
    return null;
  }
  for (const candidate of [pos, pos - 1]) {
    if (candidate < 0) continue;
    const node = view.state.doc.nodeAt(candidate);
    if (
      node?.type.name === 'inlineLink' &&
      node.attrs.entityId === target.entityId
    ) {
      return { pos: candidate, nodeSize: node.nodeSize, label: node.attrs.label || target.label };
    }
  }
  return null;
}

/**
 * Repair popover for broken inline links. Mounted once at the WorldShell
 * level; opened by the `wormhole:broken-link-click` CustomEvent dispatched
 * from useInlineLinkClicks. Offers Restore (while the target is still in the
 * recycle bin), and — when the span lives inside an editable TipTap surface —
 * Re-point and Flatten, which rewrite the link node in place.
 */
export function BrokenLinkRepairMenu() {
  const [target, setTarget] = useState<RepairTarget | null>(null);
  const [binState, setBinState] = useState<BinState>({ kind: 'loading' });
  const [editorHit, setEditorHit] = useState(false);
  const [repointing, setRepointing] = useState(false);
  const [repointQuery, setRepointQuery] = useState('');
  const [repointResults, setRepointResults] = useState<LinkableRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setTarget(null);
    setRepointing(false);
    setRepointQuery('');
    setRepointResults([]);
    setError(null);
  }, []);

  // ── Open on broken-link click ──────────────────────────────────────────
  useEffect(() => {
    function onBrokenClick(e: Event) {
      const detail = (e as CustomEvent).detail as {
        element: HTMLElement;
        entityType?: string;
        entityId?: string;
        label: string;
      };
      if (!detail?.element || !detail.entityId) return;
      if (detail.entityType !== 'character' && detail.entityType !== 'lore_document') return;
      setError(null);
      setRepointing(false);
      setRepointQuery('');
      setRepointResults([]);
      setBinState({ kind: 'loading' });
      setEditorHit(!!findEditorForElement(detail.element));
      setTarget({
        element: detail.element,
        entityType: detail.entityType,
        entityId: detail.entityId,
        label: detail.label,
        rect: detail.element.getBoundingClientRect(),
      });
    }
    window.addEventListener('wormhole:broken-link-click', onBrokenClick);
    return () => window.removeEventListener('wormhole:broken-link-click', onBrokenClick);
  }, []);

  // ── Fetch recycle-bin status for the header line ───────────────────────
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    (async () => {
      try {
        const deleted =
          target.entityType === 'character'
            ? await commands.listDeletedCharacters()
            : await commands.listDeletedLoreDocuments();
        if (cancelled) return;
        const hit = deleted.find((d) => d.id === target.entityId);
        setBinState(hit ? { kind: 'in-bin', deletedAt: hit.deleted_at } : { kind: 'purged' });
      } catch {
        if (!cancelled) setBinState({ kind: 'purged' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  // ── Dismissal: outside mousedown, Escape, scroll, detached span ────────
  useEffect(() => {
    if (!target) return;
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    function onScroll() {
      close();
    }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [target, close]);

  // ── Re-point search ────────────────────────────────────────────────────
  useEffect(() => {
    if (!repointing) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await commands.searchLinkableRecords({ query: repointQuery });
        setRepointResults(results);
      } catch (e) {
        console.error('Re-point search failed:', e);
      }
    }, 200);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [repointing, repointQuery]);

  if (!target) return null;

  async function handleRestore() {
    if (!target) return;
    try {
      if (target.entityType === 'character') {
        await commands.restoreCharacter(target.entityId);
      } else {
        await commands.restoreLoreDocument(target.entityId);
      }
      // restore commands are withLinkInvalidation-wrapped — the resolver
      // re-scan unmarks the span on its own.
      close();
    } catch (e) {
      console.error('Failed to restore link target:', e);
      setBinState({ kind: 'purged' });
      setError(String(e));
    }
  }

  function handleRepoint(record: LinkableRecord) {
    if (!target) return;
    const editor = findEditorForElement(target.element);
    if (!editor) {
      setError('The containing editor is no longer available.');
      return;
    }
    const hit = findLinkNode(editor, target);
    if (!hit) {
      setError('Could not locate the link in the document.');
      return;
    }
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(hit.pos, undefined, {
        entityType: record.entity_type,
        entityId: record.id,
        label: record.name,
      }),
    );
    invalidateBrokenLinks();
    close();
  }

  function handleFlatten() {
    if (!target) return;
    const editor = findEditorForElement(target.element);
    if (!editor) {
      setError('The containing editor is no longer available.');
      return;
    }
    const hit = findLinkNode(editor, target);
    if (!hit) {
      setError('Could not locate the link in the document.');
      return;
    }
    const text = hit.label.trim() || '[deleted]';
    editor.view.dispatch(
      editor.view.state.tr.replaceWith(
        hit.pos,
        hit.pos + hit.nodeSize,
        editor.view.state.schema.text(text),
      ),
    );
    close();
  }

  // Anchor below the span; flip above when near the viewport bottom.
  const MENU_MAX_H = 320;
  const openUp = target.rect.bottom + MENU_MAX_H > window.innerHeight;
  const style: CSSProperties = {
    left: Math.min(target.rect.left, window.innerWidth - 300),
    ...(openUp
      ? { bottom: window.innerHeight - target.rect.top + 6 }
      : { top: target.rect.bottom + 6 }),
  };

  const header =
    binState.kind === 'loading'
      ? 'Checking recycle bin…'
      : binState.kind === 'in-bin'
        ? binStatusLine(binState.deletedAt, Date.now())
        : 'Target permanently deleted';

  return createPortal(
    <div ref={menuRef} className="blr-menu" style={style} role="menu">
      <div className="blr-menu__head">
        <span
          className={`blr-menu__dot ${binState.kind === 'in-bin' ? 'blr-menu__dot--bin' : ''}`}
        />
        {header}
      </div>

      {error && <div className="blr-menu__error">{error}</div>}

      {!repointing && (
        <>
          {binState.kind === 'in-bin' && (
            <button type="button" className="blr-menu__act" onClick={handleRestore}>
              <b>Restore “{target.label || 'target'}”</b>
              <small>undeletes</small>
            </button>
          )}
          {editorHit && (
            <>
              <button
                type="button"
                className="blr-menu__act"
                onClick={() => setRepointing(true)}
              >
                <b>Re-point link…</b>
                <small>pick another</small>
              </button>
              <button type="button" className="blr-menu__act" onClick={handleFlatten}>
                <b>Flatten to plain text</b>
                <small>this one</small>
              </button>
            </>
          )}
          {binState.kind === 'purged' && !editorHit && (
            <div className="blr-menu__none">
              Nothing to repair here — the target is gone and this copy is read-only.
            </div>
          )}
        </>
      )}

      {repointing && (
        <div className="blr-menu__repoint">
          <input
            autoFocus
            type="text"
            className="blr-menu__search"
            placeholder="Search characters & lore…"
            value={repointQuery}
            onChange={(e) => setRepointQuery(e.target.value)}
          />
          <div className="blr-menu__results">
            {repointResults.map((r) => (
              <button
                key={`${r.entity_type}-${r.id}`}
                type="button"
                className="blr-menu__result"
                onClick={() => handleRepoint(r)}
              >
                <span className="blr-menu__result-dot" data-type={r.entity_type} />
                <span className="blr-menu__result-name">{r.name}</span>
                <small>{r.entity_type === 'character' ? 'Character' : 'Lore'}</small>
              </button>
            ))}
            {repointResults.length === 0 && (
              <div className="blr-menu__none">No matches.</div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
