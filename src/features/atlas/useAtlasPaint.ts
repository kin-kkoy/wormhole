import { useEffect, useRef } from 'react';
import { commands } from '../../lib/commands';
import { PAINT_RESOLUTION, PAINT_SCALE, clientToCanvas } from './coords';
import type { ZoomTransform } from './coords';

export type PaintMode = 'brush' | 'erase' | null;

interface UseAtlasPaintOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  outerRef: React.RefObject<HTMLDivElement | null>;
  transformRef: React.RefObject<ZoomTransform>;
  modeRef: React.RefObject<PaintMode>;
  colorRef: React.RefObject<string>;
  sizeRef: React.RefObject<number>;
}

/**
 * Handles freehand painting on the paint-layer canvas, with debounced
 * persistence to the backend. Sizes, colors, and mode are read from refs so
 * the hook stays stable across tool/color changes (no re-attach).
 */
export function useAtlasPaint({
  canvasRef,
  outerRef,
  transformRef,
  modeRef,
  colorRef,
  sizeRef,
}: UseAtlasPaintOptions) {
  const isPaintingRef = useRef(false);
  const lastPointRef = useRef<{ px: number; py: number } | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const loadedRef = useRef(false);

  // Load existing paint BLOB once on mount.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const layer = await commands.getPaintLayer();
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (!layer.data_base64) {
          loadedRef.current = true;
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          // If the user already painted, erased, or cleared while the BLOB
          // was loading, don't restore the old image on top of their work.
          if (dirtyRef.current) {
            loadedRef.current = true;
            return;
          }
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          // Destination-over places the loaded image underneath anything
          // already drawn — harmless here since the canvas is still empty
          // (dirtyRef is false), but defensive against near-simultaneous
          // first-stroke events that may arrive between this check and the
          // drawImage call.
          ctx.save();
          ctx.globalCompositeOperation = 'destination-over';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          ctx.restore();
          loadedRef.current = true;
        };
        img.onerror = () => {
          loadedRef.current = true;
        };
        img.src = `data:${layer.mime_type};base64,${layer.data_base64}`;
      } catch (err) {
        console.error('Failed to load paint layer:', err);
        loadedRef.current = true;
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [canvasRef]);

  const scheduleSave = () => {
    if (saveTimerRef.current != null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(flushSave, 800);
  };

  const flushSave = async () => {
    saveTimerRef.current = null;
    if (savingRef.current) {
      // Another save is in flight; retry after it completes.
      scheduleSave();
      return;
    }
    if (!dirtyRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    savingRef.current = true;
    dirtyRef.current = false;

    try {
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
      if (!blob) {
        savingRef.current = false;
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await commands.savePaintLayer(bytes);
    } catch (err) {
      console.error('Failed to save paint layer:', err);
      dirtyRef.current = true; // let the next change retry
    } finally {
      savingRef.current = false;
      if (dirtyRef.current) scheduleSave();
    }
  };

  const paintLine = (
    ctx: CanvasRenderingContext2D,
    from: { px: number; py: number },
    to: { px: number; py: number },
    sizeCanvas: number,
    color: string,
    mode: PaintMode,
  ) => {
    ctx.save();
    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = sizeCanvas * PAINT_SCALE;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.px, from.py);
    ctx.lineTo(to.px, to.py);
    ctx.stroke();
    ctx.restore();
  };

  useEffect(() => {
    const outer = outerRef.current;
    const canvas = canvasRef.current;
    if (!outer || !canvas) return;

    const handlePointerDown = (e: PointerEvent) => {
      const mode = modeRef.current;
      if (!mode) return;
      if (e.button !== 0) return;
      // Block painting until the initial BLOB load has completed so that we
      // never persist a canvas that's missing the previously-saved strokes.
      if (!loadedRef.current) return;
      const target = e.target as Element;
      if (target.closest('[data-no-pan]')) return;
      const rect = outer.getBoundingClientRect();
      const t = transformRef.current ?? { x: 0, y: 0, k: 1 };
      const canvasPt = clientToCanvas(e.clientX, e.clientY, rect, t);
      const px = canvasPt.x * PAINT_SCALE;
      const py = canvasPt.y * PAINT_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      paintLine(
        ctx,
        { px, py },
        { px, py },
        sizeRef.current ?? 40,
        colorRef.current ?? '#d4a574',
        mode,
      );
      isPaintingRef.current = true;
      lastPointRef.current = { px, py };
      dirtyRef.current = true;
      outer.setPointerCapture(e.pointerId);
      e.preventDefault();
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPaintingRef.current) return;
      const mode = modeRef.current;
      if (!mode) return;
      const rect = outer.getBoundingClientRect();
      const t = transformRef.current ?? { x: 0, y: 0, k: 1 };
      const canvasPt = clientToCanvas(e.clientX, e.clientY, rect, t);
      const px = canvasPt.x * PAINT_SCALE;
      const py = canvasPt.y * PAINT_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const last = lastPointRef.current ?? { px, py };
      paintLine(
        ctx,
        last,
        { px, py },
        sizeRef.current ?? 40,
        colorRef.current ?? '#d4a574',
        mode,
      );
      lastPointRef.current = { px, py };
      dirtyRef.current = true;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!isPaintingRef.current) return;
      isPaintingRef.current = false;
      lastPointRef.current = null;
      try {
        outer.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      scheduleSave();
    };

    outer.addEventListener('pointerdown', handlePointerDown);
    outer.addEventListener('pointermove', handlePointerMove);
    outer.addEventListener('pointerup', handlePointerUp);
    outer.addEventListener('pointercancel', handlePointerUp);

    return () => {
      outer.removeEventListener('pointerdown', handlePointerDown);
      outer.removeEventListener('pointermove', handlePointerMove);
      outer.removeEventListener('pointerup', handlePointerUp);
      outer.removeEventListener('pointercancel', handlePointerUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush any pending save when the component unmounts.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        // Fire-and-forget save in the background so tab switches don't lose
        // recent strokes. This runs synchronously enough for a small canvas.
        if (dirtyRef.current && !savingRef.current) {
          flushSave().catch(() => {});
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearAll = () => {
    // Don't clear until the initial load has completed, otherwise a late
    // load could repaint the old image over our cleared state.
    if (!loadedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, PAINT_RESOLUTION, PAINT_RESOLUTION);
    dirtyRef.current = true;
    scheduleSave();
  };

  return { clearAll };
}
