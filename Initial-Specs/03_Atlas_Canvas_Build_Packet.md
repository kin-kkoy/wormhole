# Packet 3 — Atlas Canvas Build Packet

## 1. Purpose of this packet
This packet defines the Atlas Canvas system:
- responsibilities
- scope
- data
- UI behavior
- CRUD
- constraints

## 2. System definition
Atlas Canvas is the spatial/world map system.

It lets the user interact with a world through structured, clickable map entities rather than plain notes alone.

## 3. V1 product role
Atlas Canvas gives the world a visual anchor and a place-based structure.

The point of V1 Atlas Canvas is:
- not to let the user draw a full map from scratch
- but to let them attach meaningful world records to a visual map layer

## 4. V1 scope
### Included
- animated ocean default canvas (see section 18)
- freehand region coloring (see section 19)
- optional map background image overlay
- zoom
- pan
- create map entity
- select map entity
- edit map entity
- delete map entity
- show linked characters
- show linked lore docs

### Excluded
- smart continent generation
- adjacency simulation
- border inference
- full GIS-style region logic
- decorative object system as a major feature

## 5. Map entity types
Support these values:
- region
- settlement
- landmark
- district
- infrastructure

Do not add more V1 types unless they solve a real problem.

## 6. Core Atlas concepts
### Default canvas
The canvas always starts as an **animated ocean** — a blue surface with subtle, gently moving waves. This is the base layer that exists before the user adds anything.

The animation must be lightweight (CSS animation or a simple canvas/shader effect, not a heavy simulation). In V1 it can be visually rough as long as it reads as water and moves gently.

### Map background image
The user may optionally upload a map background image that overlays on top of the ocean canvas. This is not required — a world can exist with just the ocean and placed entities.

### Map entity
A structured record placed on top of the canvas. Entity positions are **anchored to the canvas coordinate space** (not the viewport), so they stay in the correct position when the user zooms or pans.

### Selected entity panel
A details panel showing the currently selected map entity and its related records.

## 7. Data model
Use the shared `map_entities` table.

Fields:
- id (UUID)
- world_id
- parent_map_entity_id nullable
- type (enum: region, settlement, landmark, district, infrastructure)
- title (plain text, required)
- description (rich text JSON, nullable)
- x (float — canvas-space coordinate)
- y (float — canvas-space coordinate)
- width nullable (float)
- height nullable (float)
- style_token nullable
- tags_text nullable
- created_at
- updated_at
- deleted_at nullable — for recycle bin soft-delete

### Parent-child validation rules
- An entity may not be its own parent
- Circular parent-child chains are not allowed (enforced by backend)
- Max nesting depth: 5 levels
- Deleting a parent entity soft-deletes all children in the same transaction
- The UI does not display hierarchy visually in V1; parent-child is metadata only

## 8. Position model
Entity positions are stored as **coordinates anchored to the canvas world space**, not the viewport.

This means:
- when the user zooms in, entities scale and stay in place relative to the canvas
- when the user pans, entities move with the canvas
- if the user uploads a map background image, entity positions remain consistent relative to that image

Store:
- x (canvas-space coordinate)
- y (canvas-space coordinate)

Optional:
- width
- height

The coordinate system uses a fixed canvas size of **10000 x 10000 logical units**. Positions are stable regardless of window size. Do not use viewport-relative percentages.

### Zoom and pan controls
- **Zoom**: mouse wheel (range: 0.25x to 5x magnification). Trackpad pinch zoom supported.
- **Pan**: middle-mouse drag, or spacebar + left-click drag.
- Default zoom level on world open: fit canvas to viewport.

## 9. Parent-child model
`parent_map_entity_id` may be used for hierarchy such as:
- settlement inside region
- district inside settlement
- landmark inside region

This hierarchy is optional, not mandatory for every entity.

## 10. Required screens/components
### Atlas main view
Must include:
- map viewport
- map background
- markers/regions
- zoom controls
- selected entity panel
- add entity action

### Atlas entity form
Fields:
- type
- title
- description
- parent entity optional
- tags optional

### Selected entity panel
A sidebar panel on the right side of the canvas. Appears when an entity is selected; closes when user clicks empty canvas or presses Escape.

Must show:
- title
- type
- description
- parent entity if any
- linked characters
- linked lore docs
- edit button
- delete button

## 11. Entity creation flow
1. User clicks “Add Entity” button
2. A dialog opens: user fills type (required), title (required), description (optional), parent entity (optional dropdown), tags (optional)
3. User clicks “Place on Map” — canvas enters placement mode (cursor changes)
4. User clicks on the canvas at the desired location — entity marker appears
5. User may drag the marker to reposition before confirming
6. User clicks “Confirm” to save entity and coordinates to database, or “Cancel” to discard

After placement, the entity is immediately selectable and editable.

## 12. Entity editing
The user must be able to update:
- title
- type
- description
- parent entity
- coordinates
- tags/style token if used

## 13. Entity deletion
Deletion must:
- ask for confirmation
- remove related entity links
- preserve other records safely

## 14. Linked records behavior
The Atlas panel must show:
- linked characters
- linked lore docs

Linking is handled via the shared `entity_links` system.

Atlas Canvas must not invent a separate relationship model.

## 15. Visual behavior
Atlas should feel:
- calm
- readable
- clean
- spatially useful

Avoid:
- noisy markers
- flashy animation-heavy behavior
- game-editor clutter

## 16. Decorative objects
Decorative objects are not a first-class V1 requirement.

If implemented at all, keep them lightweight and clearly separate from semantic map entities.

## 17. Out-of-scope warnings
Do not drift into:
- full whiteboard app
- house-by-house simulation
- automatic country topology logic
- every visual object carrying deep metadata

Atlas Canvas in V1 is a structured spatial browser, not a world simulator.

## 18. Default canvas background
The canvas always starts as an animated ocean surface.

### Visual requirements
- base color: ocean blue (#0D4E7F or similar)
- animated wave overlay: simple horizontal wave lines with gentle vertical displacement (3–5px amplitude)
- animation loop: ~20 seconds, seamless and continuous
- target framerate: 30+ FPS on modern hardware
- must be visible and animating within 500ms of canvas load

### V1 quality bar
The animation can be visually simple in V1 — it does not need to look photorealistic. It must read as water and move gently.

### Implementation guidance
Use CSS animations or HTML canvas 2D. Do not use a heavy physics simulation, video background, or WebGL unless it simplifies the implementation.

## 19. Freehand region coloring
The user can paint areas of the canvas background with custom colors using a **freehand brush tool**.

### Purpose
This lets the user visually mark landmasses, territories, biomes, or other meaningful areas directly on the ocean canvas, without needing to upload a pre-made map image.

### Behavior
- the user selects a color and a brush size
- the user paints directly on the canvas by clicking and dragging
- painted regions persist and are saved in the world data
- painted regions sit **below** map entities but **above** the ocean animation
- the user can paint over existing regions or use an eraser

### V1 quality bar
The brush does not need advanced features like pressure sensitivity, undo per stroke, or perfect edge smoothing. A simple raster painting layer is sufficient.

### Storage
Painted region data is stored as a **single PNG image** (max 4096x4096 pixels) as a BLOB in the `canvas_paint_layers` table within the `.wormhole` database. The PNG maps 1:1 to the 10000x10000 canvas coordinate space (scaled). Brush strokes are not individually stored or undoable in V1 — the paint layer is a flat raster.

### Color picker
The user selects from any RGB color via a color picker. Eraser reverts pixels to transparent (revealing the ocean animation beneath).

### Map background image
The user may optionally upload a map background image (PNG or JPG, max 4MB). The image is displayed centered on the canvas, scaled to fit within the canvas bounds while preserving aspect ratio. The image sits above the ocean animation but below the paint layer and map entities. Users may replace or remove the background image but cannot reposition or resize it after upload.

## 20. Acceptance criteria
Atlas Canvas is acceptable when the user can:
- see the animated ocean default canvas
- paint colored regions on the canvas
- optionally set a map background image
- create map entities
- place them meaningfully (anchored to canvas space)
- select an entity
- edit/delete an entity
- see linked characters and lore docs
- zoom and pan without entities drifting from their positions
- reopen the app and find the spatial layout, painted regions, and entities persisted
