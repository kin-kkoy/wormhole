import { useEffect, useRef, forwardRef, type ReactNode } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import './GraphCanvas.css';

interface GraphCanvasProps {
  children: ReactNode;
}

export const GraphCanvas = forwardRef<SVGGElement, GraphCanvasProps>(
  function GraphCanvas({ children }, gForwardedRef) {
    const svgRef = useRef<SVGSVGElement>(null);
    const internalGRef = useRef<SVGGElement>(null);

    const setGRef = (el: SVGGElement | null) => {
      internalGRef.current = el;
      if (typeof gForwardedRef === 'function') {
        gForwardedRef(el);
      } else if (gForwardedRef) {
        gForwardedRef.current = el;
      }
    };

    useEffect(() => {
      const svg = svgRef.current;
      const g = internalGRef.current;
      if (!svg || !g) return;

      const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 4])
        // Skip zoom when the event starts on a draggable node
        .filter((event) => {
          const target = event.target as Element;
          return !target.closest('[data-draggable]');
        })
        .on('zoom', (event) => {
          select(g).attr('transform', event.transform.toString());
        });

      select(svg).call(zoomBehavior);

      const rect = svg.getBoundingClientRect();
      select(svg).call(
        zoomBehavior.transform,
        zoomIdentity.translate(rect.width / 2, rect.height / 2),
      );

      return () => {
        select(svg).on('.zoom', null);
      };
    }, []);

    return (
      <svg ref={svgRef} className="graph-canvas">
        <g ref={setGRef}>{children}</g>
      </svg>
    );
  },
);
