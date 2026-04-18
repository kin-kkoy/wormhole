/**
 * Animated ocean background — the ambient layer behind the Atlas Canvas.
 *
 * Rendered as a VIEWPORT-sized element OUTSIDE the transformed world so the
 * browser only has to paint a small area (not the full 10000×10000 canvas).
 * The wave animation uses a CSS `transform` on a pseudo-element so the
 * compositor handles it on the GPU without triggering repaints each frame.
 */
export function OceanBackdrop() {
  return <div className="atlas-ocean" aria-hidden="true" />;
}
