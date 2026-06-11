import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { commands } from '../../lib/commands';
import { useAppStore } from '../../state/store';
import { useImageCache } from '../../hooks/useImageCache';
import { tiptapJsonToText } from '../../lib/tiptapText';
import { findEditorForElement } from './editorRegistry';
import './InlineLinkHoverCard.css';

const SHOW_DELAY_MS = 350;
const EXCERPT_CHARS = 180;

interface CardData {
  kind: 'character' | 'lore_document';
  name: string;
  sub: string | null;
  excerpt: string;
  imageAssetId: string | null;
}

interface CardState {
  data: CardData;
  rect: DOMRect;
}

/** Session cache of hover-card data; cleared when the active world changes.
 *  Entries may go slightly stale after edits — acceptable for a preview. */
const cardCache = new Map<string, CardData>();

async function fetchCardData(
  entityType: 'character' | 'lore_document',
  entityId: string,
): Promise<CardData | null> {
  const key = `${entityType}:${entityId}`;
  const cached = cardCache.get(key);
  if (cached) return cached;

  try {
    let data: CardData;
    if (entityType === 'character') {
      const c = await commands.getCharacter(entityId);
      data = {
        kind: 'character',
        name: c.name,
        sub: c.short_role,
        excerpt:
          tiptapJsonToText(c.in_character_intro, EXCERPT_CHARS) ||
          tiptapJsonToText(c.objective_summary, EXCERPT_CHARS),
        imageAssetId: c.image_asset_id,
      };
    } else {
      const d = await commands.getLoreDocument(entityId);
      data = {
        kind: 'lore_document',
        name: d.title,
        sub: null,
        excerpt: tiptapJsonToText(d.content, EXCERPT_CHARS),
        imageAssetId: null,
      };
    }
    cardCache.set(key, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * Glossary hover popover for inline `[[links]]` (Proposal 04). Mounted once
 * in WorldShell. Hovering a link span in a READ-ONLY surface (Read Mode
 * paper, peek panel) shows a floating preview card after a short delay —
 * character portrait + intro, or document title + opening lines. Never
 * appears inside an editable editor (typing) or on broken links. The card
 * ignores pointer events, so clicking the span still navigates normally.
 */
export function InlineLinkHoverCard() {
  const [card, setCard] = useState<CardState | null>(null);
  const { getImageUrl, loadImages } = useImageCache();
  const activeWorld = useAppStore((s) => s.activeWorld);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTokenRef = useRef(0);

  // Stale previews must not leak across worlds.
  useEffect(() => {
    cardCache.clear();
    setCard(null);
  }, [activeWorld?.id]);

  useEffect(() => {
    function cancelPending() {
      hoverTokenRef.current += 1;
      if (showTimerRef.current) {
        clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    }

    function onMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      const link = target.closest<HTMLElement>('[data-inline-link]');
      if (!link) return;
      if (link.dataset.broken === '1') return;
      const entityType = link.dataset.entityType;
      const entityId = link.dataset.entityId;
      if (!entityId || (entityType !== 'character' && entityType !== 'lore_document')) return;
      // No previews while writing — only read-only surfaces get them.
      if (findEditorForElement(link)) return;

      cancelPending();
      const token = hoverTokenRef.current;
      showTimerRef.current = setTimeout(async () => {
        const data = await fetchCardData(entityType, entityId);
        if (!data || token !== hoverTokenRef.current) return;
        // Resolve the portrait BEFORE showing the card, so it never pops in
        // a frame late.
        if (data.imageAssetId) {
          try {
            await loadImages([data.imageAssetId]);
          } catch {
            /* portrait is optional */
          }
        }
        if (token !== hoverTokenRef.current || !link.isConnected) return;
        setCard({ data, rect: link.getBoundingClientRect() });
      }, SHOW_DELAY_MS);
    }

    function onMouseOut(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      if (!target.closest('[data-inline-link]')) return;
      cancelPending();
      setCard(null);
    }

    function onHide() {
      cancelPending();
      setCard(null);
    }

    window.addEventListener('mouseover', onMouseOver, true);
    window.addEventListener('mouseout', onMouseOut, true);
    window.addEventListener('scroll', onHide, true);
    window.addEventListener('mousedown', onHide, true);
    return () => {
      cancelPending();
      window.removeEventListener('mouseover', onMouseOver, true);
      window.removeEventListener('mouseout', onMouseOut, true);
      window.removeEventListener('scroll', onHide, true);
      window.removeEventListener('mousedown', onHide, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!card) return null;

  const { data, rect } = card;
  const CARD_WIDTH = 240;
  const centerX = rect.left + rect.width / 2;
  const left = Math.min(
    Math.max(8, centerX - CARD_WIDTH / 2),
    window.innerWidth - CARD_WIDTH - 8,
  );
  // Above the span by default; flip below when near the viewport top.
  const openBelow = rect.top < 140;
  const style: CSSProperties = {
    left,
    width: CARD_WIDTH,
    ...(openBelow
      ? { top: rect.bottom + 8 }
      : { bottom: window.innerHeight - rect.top + 8 }),
  };

  const imageUrl = data.imageAssetId ? getImageUrl(data.imageAssetId) : null;

  return createPortal(
    <div className="il-hover-card" style={style} role="tooltip">
      <div className="il-hover-card__header">
        {data.kind === 'character' ? (
          imageUrl ? (
            <img className="il-hover-card__avatar" src={imageUrl} alt="" />
          ) : (
            <span className="il-hover-card__avatar il-hover-card__avatar--mono">
              {data.name.charAt(0).toUpperCase()}
            </span>
          )
        ) : (
          <span className="il-hover-card__avatar il-hover-card__avatar--doc">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
              <path d="M3.5 1.5h6l3 3v10h-9v-13z" strokeLinejoin="round" />
              <path d="M9.5 1.5v3h3" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        <span className="il-hover-card__id">
          <span className="il-hover-card__name">{data.name}</span>
          <span className="il-hover-card__type">
            {data.kind === 'character'
              ? data.sub || 'Character'
              : 'Lore document'}
          </span>
        </span>
      </div>
      {data.excerpt && <p className="il-hover-card__excerpt">{data.excerpt}</p>}
    </div>,
    document.body,
  );
}
