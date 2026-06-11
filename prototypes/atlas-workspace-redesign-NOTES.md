# Atlas Workspace Redesign — Design Notes

Companion to `atlas-workspace-redesign.html` (2026-06-10). Open the prototype in any
browser; it is fully self-contained (the Google Fonts import mirrors the app's bundled
OFL families — Cinzel, Cormorant Garamond, Inter, JetBrains Mono — and degrades to
system stacks offline).

## The concept: "The Cartographer's Table"

The previous Atlas iterations (V1 ocean canvas, Packet 9 3D terrain) treated the map as
a *screen* — edge-to-edge canvas with floating controls. This redesign treats the map as
an *artifact on a desk*: a bounded, gold-framed map sheet floating in the scriptorium
void, with the workspace chrome arranged around it like a drafting table. This does
three things at once:

1. **Identity** — it visually unifies Atlas with the rest of Wormhole (Lore's paper,
   Characters' cards: every system presents a crafted *object*, not a viewport).
2. **Orientation** — a bounded sheet with a frame makes world extent legible at a
   glance; users always know where the world ends.
3. **Performance honesty** — the rendering is exactly the adopted blueprint:
   `Float32Array` grid → marching-squares isolines → plain 2D canvas. The prototype's
   interactive terrain (raise / carve / smooth, smart coastline paint) runs the real
   algorithm, so the look shown here is the look the production renderer produces.

## Information architecture

Three fixed zones, no overlapping tool clutter:

- **Left: tool rail (58px)** — verb-shaped tools only (Select, Raise, Carve, Smooth,
  Marker), grouped under small-caps Cinzel labels with a gold hairline rule between
  groups. Hover tooltips carry keyboard shortcuts. Undo anchors the bottom.
- **Center: the stage** — the map sheet plus exactly three floating elements: a
  contextual tool-options bar (top, glass), a minimap (bottom-left), and a dismissible
  "Getting started" coach card (first-run onboarding).
- **Right: context panel (296px)** — three tabs: **Layers** (the blueprint's 3-tier
  Sky / Surface / Underground model made directly visible to the user), **Inspector**
  (selected marker: type chip, serif name, coordinates + live elevation, linked records
  colored by target system, field notes), **Legend** (elevation bands explained).

Status bar carries the quiet telemetry: cursor world-coordinates + elevation, zoom,
grid size, active tool, autosave indicator.

## Key decisions

- **Three typographic voices, strictly cast** — Cinzel small-caps for structural labels
  (rails, panel tabs, tier heads), Cormorant Garamond for content (world title, marker
  names, notes — the "ink" voice), Inter for UI controls, JetBrains Mono for data
  (coordinates, elevations). Hierarchy is carried by typeface role, not by size inflation.
- **The coastline is gold** — elevation-zero isoline stroked in the scriptorium's brass
  (`#c9b898`), making the app's signature hairline literally draw the world. Inner
  contour rings are faint warm-white; the shelf edge is faint atlas blue.
- **Linked records colored by target system** (purple = character, amber = lore),
  identical to inline-link behavior elsewhere in the app — cross-system grammar stays
  consistent.
- **Discoverability without modal tutorials** — coach card (3 shortcuts + Ctrl K),
  hover tooltips with kbd hints, and a command palette that exposes every tool, layer
  toggle, and marker (with fly-to). Experts get shortcuts (V/B/C/S/P, `[` `]` brush,
  Ctrl Z); novices can find everything by typing.
- **Long-session comfort** — dark void default with warm ink text (no pure white), one
  glass blur surface, zero continuous animation. All motion is short, interaction-
  triggered CSS. Terrain repaint is a single supersampled pass over a 480×480 buffer
  (~10ms); view changes are a cached `drawImage` — modest-hardware friendly and
  WebKitGTK-safe (no rAF-dependent idle loops).
- **Light theme = parchment desk** — the map sheet keeps its own cartographic palette
  (it is the artifact); only the desk around it changes.

## Most important improvements vs. the previous Atlas experience

1. Persistent, structured tool organization (rail + contextual options) replaces ad-hoc
   floating toolbars; tools are discoverable, labeled, and shortcut-mapped.
2. The 3-tier layer model is now user-facing IA, not just a storage schema — Sky /
   Surface / Underground reads as a promise of the roadmap (Underground is honestly
   labeled as upcoming rather than hidden).
3. Markers are first-class linked entities with an inspector, not anonymous canvas dots
   — they participate in the entity-link system visibly.
4. Orientation tooling (bounded sheet, minimap with viewport rect, survey grid layer,
   legend) — previously absent.
5. Command palette + status-bar telemetry: efficiency for advanced users without adding
   chrome.
6. Visual cohesion with the rest of Wormhole (tokens, hairlines, voices) — Atlas no
   longer looks like a different product embedded in the app.

## Implementation priorities

| Priority | Element | Why first |
|---|---|---|
| 1 | Three-zone shell (rail / stage / context panel) + bounded gold-framed sheet | Everything else hangs off this skeleton; cheap to build, biggest cohesion win |
| 2 | Terrain renderer as prototyped (supersampled band fill + MS contour ink, gold coastline) | Already validated; defines the product's visual signature |
| 3 | Layers tab wired to the 3-tier model | Makes the adopted architecture legible; trivial state work |
| 4 | Marker → Inspector → entity-links flow | Highest cross-system value; reuses LinkPickerDialog / PeekPanel |
| 5 | Tool options bar + shortcuts + status bar | Efficiency layer; small surface |
| 6 | Command palette (extend existing Ctrl+K search with actions) | Builds on GlobalSearchBar; defer until search unification is planned |
| 7 | Minimap, coach card, legend | Polish; ship after core editing loop is stable |

Deliberately **not** in this prototype: the 2D→3D zoom transition (Future-Feature-Plans
§1 — the bounded-sheet composition is designed to survive it: the sheet becomes the
terrain plane), rivers/roads/region-label tools (need their own data-model packets),
and multi-map support.
