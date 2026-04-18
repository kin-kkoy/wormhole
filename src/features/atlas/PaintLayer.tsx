import { forwardRef } from 'react';
import { CANVAS_SIZE, PAINT_RESOLUTION } from './coords';

interface PaintLayerProps {
  interactive: boolean;
}

/**
 * The freehand paint layer. The backing canvas is at PAINT_RESOLUTION (4096)
 * and is CSS-scaled to the full 10000 canvas space via width/height style.
 * Pointer events are forwarded to the outer zoom container for painting —
 * this element is purely a rendering surface.
 */
export const PaintLayer = forwardRef<HTMLCanvasElement, PaintLayerProps>(
  function PaintLayer({ interactive }, ref) {
    return (
      <canvas
        ref={ref}
        className="atlas-paint"
        width={PAINT_RESOLUTION}
        height={PAINT_RESOLUTION}
        style={{
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      />
    );
  },
);
