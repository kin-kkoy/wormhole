import { useCallback, useEffect, useRef } from 'react';

interface DragState {
  nodeId: string;
  startSvgX: number;
  startSvgY: number;
  origPositions: Map<string, { x: number; y: number }>;
}

/**
 * Hook for dragging graph nodes (and their descendants) in SVG space.
 * Uses native DOM events so d3-zoom's filter can properly skip them.
 */
export function useGraphDrag(
  positions: Map<string, { x: number; y: number }>,
  setPositions: (p: Map<string, { x: number; y: number }>) => void,
  getDescendants: (nodeId: string) => string[],
) {
  const gRef = useRef<SVGGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  // Keep latest positions/getDescendants accessible in native event handlers
  const posRef = useRef(positions);
  posRef.current = positions;
  const descRef = useRef(getDescendants);
  descRef.current = getDescendants;
  const setRef = useRef(setPositions);
  setRef.current = setPositions;

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const g = gRef.current;
    if (!g) return { x: clientX, y: clientY };
    const svg = g.ownerSVGElement;
    if (!svg) return { x: clientX, y: clientY };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = g.getScreenCTM()?.inverse();
    if (!ctm) return { x: clientX, y: clientY };
    const svgPt = pt.matrixTransform(ctm);
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  // Attach native pointermove/pointerup on document during drag
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;

      const svg = clientToSvg(e.clientX, e.clientY);
      const dx = svg.x - drag.startSvgX;
      const dy = svg.y - drag.startSvgY;

      const descendants = descRef.current(drag.nodeId);
      const next = new Map(posRef.current);

      for (const id of descendants) {
        const orig = drag.origPositions.get(id);
        if (orig) {
          next.set(id, { x: orig.x + dx, y: orig.y + dy });
        }
      }

      setRef.current(next);
    }

    function onUp() {
      dragRef.current = null;
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [clientToSvg]);

  /** Call this from onPointerDown on each draggable node <g> */
  const startDrag = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      // stopPropagation not needed — d3-zoom's filter already skips [data-draggable]
      const svg = clientToSvg(e.clientX, e.clientY);
      dragRef.current = {
        nodeId,
        startSvgX: svg.x,
        startSvgY: svg.y,
        origPositions: new Map(posRef.current),
      };
    },
    [clientToSvg],
  );

  return { gRef, startDrag };
}
