import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { ZoomTransform } from './coords';
import { fitToViewport } from './coords';

interface UseAtlasZoomOptions {
  outerRef: React.RefObject<HTMLDivElement | null>;
  innerRef: React.RefObject<HTMLDivElement | null>;
  onTransformChange: (t: ZoomTransform) => void;
  // Skip zoom/pan behavior when this returns true (e.g. while painting).
  shouldSkip: () => boolean;
  // Allow left-click drag to pan (when pan tool is active).
  allowLeftClickPan: () => boolean;
}

/**
 * Attach d3-zoom to an HTML container and apply the CSS transform to an inner
 * element. Pan triggers on middle-mouse OR left-click while space is held OR
 * when the pan tool is active (allowLeftClickPan).
 *
 * This hook ATTACHES ONCE on mount; the predicate callbacks are read via refs
 * so that changing tools/state does NOT re-attach d3-zoom (which would reset
 * the zoom/pan state).
 */
export function useAtlasZoom({
  outerRef,
  innerRef,
  onTransformChange,
  shouldSkip,
  allowLeftClickPan,
}: UseAtlasZoomOptions) {
  const zoomBehaviorRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const spaceHeldRef = useRef(false);

  // Latest callbacks via refs so the effect below never re-runs.
  const shouldSkipRef = useRef(shouldSkip);
  const allowLeftClickPanRef = useRef(allowLeftClickPan);
  const onTransformChangeRef = useRef(onTransformChange);
  useEffect(() => {
    shouldSkipRef.current = shouldSkip;
  }, [shouldSkip]);
  useEffect(() => {
    allowLeftClickPanRef.current = allowLeftClickPan;
  }, [allowLeftClickPan]);
  useEffect(() => {
    onTransformChangeRef.current = onTransformChange;
  }, [onTransformChange]);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const rect = outer.getBoundingClientRect();
    const fit = fitToViewport(rect.width, rect.height);

    // Dynamic scale extent: allow fit-to-viewport, respect spec's max 5x.
    // Lower bound is whichever is smaller, the spec's 0.25x or the fit scale
    // itself (so the canvas can always shrink to fit). Upper bound is 5x.
    const minScale = Math.min(0.25, fit.k * 0.5);
    const maxScale = 5;

    const behavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([minScale, maxScale])
      .filter((event: Event) => {
        if (shouldSkipRef.current()) return false;
        const target = event.target as Element;
        if (target.closest('[data-entity-drag]')) return false;
        if (target.closest('[data-no-pan]')) return false;
        if (event.type === 'wheel') return true;
        if (event.type === 'touchstart') return true;
        const me = event as MouseEvent;
        if (me.button === 1) return true;
        if (me.button === 0 && spaceHeldRef.current) return true;
        if (me.button === 0 && allowLeftClickPanRef.current()) return true;
        return false;
      })
      .on('zoom', (event) => {
        const { x, y, k } = event.transform;
        inner.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
        onTransformChangeRef.current({ x, y, k });
      });

    zoomBehaviorRef.current = behavior;
    select(outer).call(behavior);

    // Apply initial fit-to-viewport
    select(outer).call(
      behavior.transform,
      zoomIdentity.translate(fit.x, fit.y).scale(fit.k),
    );
    inner.style.transform = `translate(${fit.x}px, ${fit.y}px) scale(${fit.k})`;
    onTransformChangeRef.current(fit);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        // WorldShell keeps the Atlas DOM mounted (display:none) when inactive,
        // so skip key handling whenever the outer canvas isn't actually
        // visible — otherwise Space on the Characters/Lore tabs would break.
        if (outer.offsetParent === null) return;
        // Don't hijack space inside text inputs / contenteditable.
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
          return;
        }
        if (!spaceHeldRef.current) {
          spaceHeldRef.current = true;
          outer.classList.add('atlas-canvas--space-held');
        }
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeldRef.current = false;
        outer.classList.remove('atlas-canvas--space-held');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      select(outer).on('.zoom', null);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      zoomBehaviorRef.current = null;
      outer.classList.remove('atlas-canvas--space-held');
    };
    // Attach once on mount; tool changes are read via refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
