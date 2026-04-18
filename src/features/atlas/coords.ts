// Atlas Canvas coordinate helpers (Stage 5)
// Canvas logical size is fixed at 10000 x 10000 units.
// Paint layer resolution is 4096 x 4096 pixels.

export const CANVAS_SIZE = 10000;
// Spec caps paint raster at 4096×4096. Default to 2048 for 4× less GPU memory
// (16 MB backing store vs 64 MB) — still plenty of detail for region painting.
export const PAINT_RESOLUTION = 2048;
export const PAINT_SCALE = PAINT_RESOLUTION / CANVAS_SIZE; // ≈ 0.2048

export interface ZoomTransform {
  x: number;
  y: number;
  k: number;
}

export function identityTransform(): ZoomTransform {
  return { x: 0, y: 0, k: 1 };
}

/**
 * Convert a client (viewport) pixel coord into canvas-space coords, given the
 * bounding rect of the zoom container and the current d3-zoom transform.
 */
export function clientToCanvas(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  transform: ZoomTransform,
): { x: number; y: number } {
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  return {
    x: (localX - transform.x) / transform.k,
    y: (localY - transform.y) / transform.k,
  };
}

/**
 * Convert a canvas-space coord to paint-layer pixel coord (4096-space).
 */
export function canvasToPaintPixel(x: number, y: number): { px: number; py: number } {
  return {
    px: x * PAINT_SCALE,
    py: y * PAINT_SCALE,
  };
}

/**
 * Compute the transform that fits the 10000x10000 canvas into a given
 * viewport while preserving aspect ratio and centering.
 */
export function fitToViewport(viewportW: number, viewportH: number): ZoomTransform {
  if (viewportW <= 0 || viewportH <= 0) return identityTransform();
  const k = Math.min(viewportW / CANVAS_SIZE, viewportH / CANVAS_SIZE) * 0.95;
  const x = (viewportW - CANVAS_SIZE * k) / 2;
  const y = (viewportH - CANVAS_SIZE * k) / 2;
  return { x, y, k };
}
