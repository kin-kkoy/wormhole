# Packet 9 — Atlas Canvas v2: 3D, Painting, Layers, Shaders

> **Status:** Spec draft, 2026-04-19. Supersedes the V1 freehand region coloring described in Packet 3 (`03_Atlas_Canvas_Build_Packet.md`) once implemented. V1 ships first; this packet defines the next-major evolution.
>
> **Reference prototype:** `prototypes/atlas-canvas-painting-prototype.html` — standalone Three.js demo of the painting + layer + cutaway model. Open in a browser. The behavior described here mirrors that prototype as the baseline.

---

## 1. Purpose

Replace the V1 paint-region tool with a layered, paintable, optionally-3D world map. The user paints terrain by selecting a **layer** (elevation band) and a **material** (surface color / type) from that layer's palette. The terrain deforms in real time; the map is fully 2D top-down at strategic zoom and seamlessly tilts into a 3D perspective view as the user zooms in.

The system is **local-first**, **single-user**, and renders entirely in the existing React + Tauri shell using Three.js (via R3F when integrated).

---

## 2. Goals (and explicit non-goals)

### Goals
- Painting **looks** like a 2D map (Zelda / Genshin layout) when zoomed out.
- Painting **feels** like sculpting terrain — the brush both colors the surface and changes elevation.
- Layers are intuitive: pick "Mountain", paint, terrain rises; pick "Deep Ocean", paint, it sinks.
- Underground spaces (cave systems, subterranean cities) are first-class — not a hack on top of the surface system.
- A separate, opt-in **Shader Addon** layer can later add Minecraft-style atmospherics (animated grass, water ripples, dynamic shadows) without touching the core painting model.

### Non-goals
- **No voxel terrain.** Heightmap-based, so no overhangs / floating islands / true caves with ceilings. Underground is a separate stacked surface, not a carved 3D volume.
- **No procedural world generation.** The user paints; no "auto-generate continent" button.
- **No GIS-grade accuracy.** Coordinates are arbitrary world units. There is no real-world scale.
- **No multi-user / collaborative editing.** Wormhole is single-user.
- **No imported 3D models in v2.** Entities (settlements / landmarks) use the existing 2D markers stacked above the new terrain. 3D entity geometry is a v3 idea.

---

## 3. Data model

### 3.1 World-level

Each world owns one Atlas Canvas dataset. Stored in the world `.wormhole` SQLite file.

```
atlas_canvas (one row per world):
  world_id           TEXT PRIMARY KEY (FK → worlds)
  size               INTEGER NOT NULL  -- world units per side, default 100
  resolution         INTEGER NOT NULL  -- vertices per side, default 161
  splat_resolution   INTEGER NOT NULL  -- material texture px per side, default 512
  view_state_json    TEXT              -- last camera position, target, zoom (UI hint, not load-bearing)
  shader_pack_id     TEXT              -- nullable; FK → shader_packs.id when shaders enabled
  created_at         TEXT NOT NULL
  updated_at         TEXT NOT NULL
```

### 3.2 Heightmap

Stored as a single BLOB:
```
atlas_heightmap (one row per world):
  world_id           TEXT PRIMARY KEY (FK → worlds)
  data               BLOB NOT NULL    -- Float32Array, length = resolution * resolution
  updated_at         TEXT NOT NULL
```
Each value is normalized 0..1; multiplied by `MAX_HEIGHT` (default 8.0 world units) at render time. 161×161 floats = ~104 KB per world.

### 3.3 Material splat textures (one per surface)

```
atlas_splat (per world, per surface):
  world_id           TEXT NOT NULL (FK → worlds)
  surface            TEXT NOT NULL    -- 'upper' | 'underground'
  data               BLOB NOT NULL    -- raw RGBA8, length = splat_resolution * splat_resolution * 4
  updated_at         TEXT NOT NULL
  PRIMARY KEY (world_id, surface)
```
512×512 RGBA = 1 MB per surface, ~2 MB total per world. PNG-compressed if disk space matters; raw is fine.

### 3.4 Layer + material registry (constants, in code, not DB)

Layers are a fixed enumerable list. Materials are a fixed enumerable list grouped by layer. Users do not create new layers or materials in v2 (that's v3).

```ts
// src/features/atlas-v2/layers.ts (planned)
export const LAYERS = [
  { id: 'mountain',    num: 4, name: 'Mountain',         targetH: 6.5, palette: ['stone', 'snow', 'rock'] },
  { id: 'ground',      num: 3, name: 'Ground',           targetH: 2.5, palette: ['grass', 'sand', 'dirt'] },
  { id: 'shallow',     num: 2, name: 'Shallow Water',    targetH: 0.9, palette: ['sandbed', 'coral', 'kelp'] },
  { id: 'deep',        num: 1, name: 'Deep Ocean',       targetH: 0.0, palette: ['deepfloor', 'trench'] },
  { id: 'underground', num: 0, name: 'Underground',      targetH: null, palette: ['caveentrance', 'cavestone', 'lava', 'crystal'] },
];
```

`targetH` is in world Y units after the 2D→3D transition is fully active (i.e. `currentTerrainScale = 1`). `null` means the layer does not modify upper-terrain elevation (Underground only).

---

## 4. View modes (zoom-driven transition)

There is **one canvas, one camera**. The mode is purely a function of camera distance.

| Distance band         | Mode name        | Terrain scale | Camera tilt          | UI cues             |
|-----------------------|------------------|---------------|----------------------|---------------------|
| dist > 70% of max     | **Strategic**    | flat (0)      | top-down (~0°)       | Grid visible, fog off |
| 30–70% of max         | **Tactical**     | partial       | tilting (0–60°)      | Grid fading         |
| dist < 30% of max     | **Immersive**    | full (1)      | perspective (~60°)   | Grid off, fog on, atmospherics |

Transition equations (from prototype, copy verbatim):
```
t = 1 - clamp((dist - CAM_MIN_DIST) / (CAM_MAX_DIST - CAM_MIN_DIST), 0, 1)
terrainScale = smoothstep(t, 0.05, 0.55)     // smooths the rise
targetPolar  = lerp(0.08, 1.05, smoothstep(t, 0.15, 0.7))  // camera tilt in radians
fogDensity   = lerp(0.0, 0.012, smoothstep(t, 0.4, 0.9))
gridOpacity  = lerp(0.4, 0.0, smoothstep(t, 0.2, 0.5))
```

The transition is **continuous**. No mode toggle button. Camera distance alone drives all visual changes.

---

## 5. Painting model

### 5.1 The brush

Inputs:
- `activeLayer` — one of the LAYERS entries.
- `activeMaterial` — an id from `activeLayer.palette`.
- `brushRadius` — world units, range 1–14, default 6.
- `brushStrength` — 0..1, default 0.5. Controls per-stroke push toward target height + alpha of color fill.

A brush stroke is a continuous pointer drag. Between two consecutive sample points, sub-strokes are interpolated at `max(brushRadius * 0.4, 0.5)` world-unit spacing so fast drags still paint continuously.

### 5.2 Per-stroke effects

For each sample point at world `(x, z)`:

#### a) Heightmap update (for layers with `targetH !== null`)

For every vertex `(r, c)` within `brushRadius` of `(x, z)`:
```
d        = euclidean distance from vertex to brush center
fall     = 1 - smoothstep(d / brushRadius, 0, 1)   // 1 at center, 0 at edge
heights[r,c] = lerp(heights[r,c], targetH / MAX_HEIGHT, fall * brushStrength)
```

Implications:
- Painting Mountain (targetH = 6.5) onto a flat plain raises terrain toward h=6.5/8 = 0.81.
- Painting Deep Ocean (targetH = 0) onto a mountain digs it back down.
- Brush soft edges produce **slopes** between layers automatically. The user does not need a separate slope tool.
- High strength = fast convergence; low strength = subtle gradual shaping.

#### b) Material splat update (always)

For pixels within `brushRadius` (mapped to splat-canvas pixels) of the brush center, draw a filled circle with `globalAlpha = clamp(brushStrength * 1.5, 0.2, 1)` and `fillStyle = MATERIALS[activeMaterial].color`.

For Underground layer:
- If `MATERIALS[activeMaterial].cutout === true` (the Cave Entrance material): use `globalCompositeOperation = 'destination-out'` on the **upper** splat → punches alpha=0 holes that the upper terrain mesh discards via `alphaTest: 0.5`.
- Otherwise: paint the **underground** splat directly.

### 5.3 Layer thresholds & visual handoff

There is **no implicit material-by-elevation mapping in the painted state**. Whatever material the user paints, that's what's there, regardless of height. This is intentional — the user owns their map.

However, the **starter / pre-baked terrain** (and the `Reset Map` action) does use elevation-tier material assignment to give a sensible default:

| Height (0..1)   | Default material assigned during pre-bake |
|-----------------|-------------------------------------------|
| < 0.05          | Trench (deep ocean floor)                 |
| 0.05–0.18       | Deep ocean floor                          |
| 0.18–0.30       | Sandbed (shallow water bottom)            |
| 0.30–0.36       | Sand (coast)                              |
| 0.36–0.62       | Grass (with noise-driven dirt patches)    |
| 0.62–0.82       | Stone (foothills)                         |
| > 0.82          | Snow (peaks)                              |

This table is a **suggestion to the user** via the pre-bake, not a constraint on painting. After the first user stroke, the map is whatever they paint.

### 5.4 Underground mode special behavior

When `activeLayer.id === 'underground'`:
- Upper terrain material opacity dims to **0.35** (cutaway view), with `depthWrite = false` so the underground floor below blends through cleanly.
- Water layers (deep + shallow) hide entirely.
- Pointer raycasts target the **underground** mesh, not the upper terrain.
- Painting any non-cutout material writes to the underground splat.
- Painting the Cave Entrance material writes alpha=0 to the upper splat (cuts a hole), but does **not** write to the underground splat.

When the user switches off Underground, opacity smoothly returns to 1.0 over ~10 frames (lerp factor 0.12), water layers reappear.

### 5.5 Reset / Clear actions

- **Reset Map**: re-runs the pre-bake (small island starter scene, including one demo cave entrance on the mountain peak).
- **Clear All**: heights → 0, upper splat → solid `deepfloor` color, underground splat → solid `cavestone`. Gives the user a flat blank ocean to start from.

Both actions discard unsaved painting work — show a confirmation dialog.

---

## 6. Layer behavior detail

### 6.1 The "what does painting on Layer X do" matrix

| Layer        | Heightmap effect              | Upper splat effect                   | Underground splat effect | Other side-effects                  |
|--------------|-------------------------------|--------------------------------------|--------------------------|--------------------------------------|
| Mountain     | Push heights toward 6.5/8     | Paint material color                 | none                     | none                                 |
| Ground       | Push heights toward 2.5/8     | Paint material color                 | none                     | none                                 |
| Shallow      | Push heights toward 0.9/8     | Paint material color (sandbed/coral) | none                     | none                                 |
| Deep         | Push heights toward 0.0/8     | Paint material color (deepfloor)     | none                     | none                                 |
| Underground  | none (flat heights)           | Punch hole (Cave Entrance only)      | Paint material color     | Toggles cutaway view                 |

### 6.2 Why elevation thresholds aren't enforced post-paint

The user might paint a "Mountain" layer stroke that only barely raises terrain (low strength + soft brush). The result is a small bump, not a 6.5-unit peak. That's intentional — the layer's `targetH` is a *target*, not a clamp. The brush eases toward it.

If we ever want strict "this region MUST be at mountain elevation" semantics (e.g. for AI worldbuilding queries: "list all mountain regions"), we add a separate **layer mask** per-texel later (one byte per splat texel naming the user's intended layer). v2 ships without this — the painted material color carries enough intent for the prototype's purpose.

### 6.3 Underground layer model (caves vs sub-map)

The underground is **one global flat plane** at `Y_UNDERGROUND = -3`. Visible:
- Through cave-entrance holes punched in the upper terrain.
- In cutaway view when Underground layer is active.

It is **not** a separate sub-world the user navigates into. Caves connect via holes; "underground city" = a region of the underground floor painted with cave materials, visible from the surface only through entrances.

This is a deliberate v2 simplification. A future v3 may add a "switch to underground sub-map" toggle that hides everything else — easier mental model for sprawling subterranean civilizations — but v2 ships with the cutaway model.

---

## 7. Brush UI

A persistent left-side panel (270px wide), full-height between the top and bottom HUDs. Sections top-to-bottom:

1. **Active layer banner** — large pill showing `LayerName · MaterialName` and the layer number + target height. Updates on any selection change.
2. **Layer selector** — five rows in fixed top-down order (L4 Mountain → L0 Underground). Each row shows the layer number, color dot, name, and `h X.X` (or `cave` for Underground). Click to activate.
3. **Material swatches** — grid of 2 columns. Contents change based on active layer's palette. Cave Entrance swatch is rendered with a distinctive amber X-pattern background to communicate "this is a cutout, not a color."
4. **Brush size slider** — range 1–14 world units.
5. **Brush strength slider** — range 5–100%.
6. **Hint text** — context-sensitive. Default explains layer = elevation; Underground mode explains the cutaway behavior.

Top bar adds two action buttons: `Reset Map`, `Clear All` (each behind a confirmation dialog).

Bottom bar's coords block extends with a `Brush: L3 Ground · Grass`-style readout.

---

## 8. Shader Addon System

### 8.1 What it is

An **opt-in, downloadable** plugin layer that adds atmospheric / animated visual effects on top of the core painting model. Inspired by Minecraft's shader packs (BSL, Sildur's, etc).

By default, no shader pack is installed. The base render is the prototype's stock Three.js (Lambert materials, one directional light, basic fog). Shader packs add richer fragment shaders, post-processing, and animation.

### 8.2 Why it's an addon, not core

- File size: shader packs include large texture atlases (normal maps, water normals, detail textures). Wanting them is user-specific.
- Performance: shaders cost framerate. Many users will be on weaker hardware where the base render is the right experience.
- Aesthetics are personal. Different shader packs give different *moods* (gritty, dreamy, painterly).
- Keeps the core stable. Painting model never changes when shaders evolve.

### 8.3 Pack structure (conceptual — not implemented in v2)

A shader pack is a `.wh-shaderpack` zip:
```
mypack.wh-shaderpack/
  pack.json                   # name, version, author, compatibility, requires
  textures/
    grass_diffuse.png
    grass_normal.png
    water_normal_a.png
    water_normal_b.png
    snow_diffuse.png
    ...
  shaders/
    terrain.vert
    terrain.frag
    water.frag
    grass.frag             # animated grass blade fragment shader
    sky.frag
  postprocess/
    bloom.json
    ssao.json
  preview.png              # 256x256 preview shown in the picker
```

The app loads the pack at startup, replaces the stock terrain `MeshLambertMaterial` with a `ShaderMaterial` wrapping the pack's `terrain.vert / .frag`, and feeds it the splat texture + heightmap as samplers + a small uniform set (sun direction, time, camera).

### 8.4 Effects packs may include

| Effect              | Description                                                             |
|---------------------|-------------------------------------------------------------------------|
| Animated grass      | Grass-colored texels in the splat get blade geometry that sways         |
| Water ripples       | Shallow / deep ocean planes use animated normal maps, true reflections  |
| Dynamic shadows     | Cascaded shadow maps from the directional sun                           |
| Volumetric fog      | Per-pixel fog with sun god-rays                                         |
| Wind on trees       | Tree decoration objects sway (when entity-decoration system exists)     |
| Bloom / tone map    | Post-processing for HDR-feel sunlight                                   |
| Snow accumulation   | Snow material gets sparkle, footprint indents (animation only)          |
| Lava glow           | Underground lava material emits light, casts color on nearby walls      |
| Crystal refraction  | Crystal material refracts cave-glow light                               |

Packs need not include all effects. A minimalist pack might only do animated grass + water.

### 8.5 UX entry point

A `Shaders` button in the Atlas Canvas top bar (only visible when in Atlas tab). Opens a modal:
- Lists installed packs (none by default).
- `Install pack...` button → file picker, accepts `.wh-shaderpack` zips.
- `Browse community packs` link → external (no in-app store v2; just link to a docs page listing community packs).
- For each installed pack: preview image, enable/disable toggle, uninstall.

Only one pack active at a time. Switching packs reloads the Atlas materials (1–2 second flash, no need for app restart).

### 8.6 Performance / safety

Shader packs run user-supplied GLSL. To keep this safe(-ish):
- Compile shaders in a try/catch. If compilation fails, fall back to stock material and surface the error in the modal.
- Hard cap on pack size: 50 MB. Larger packs are rejected at install.
- No external network access from shaders. Tauri backend never proxies for them.
- Disable the shader pack automatically if frame time exceeds 33ms (30fps) for 5 consecutive seconds. User notified, can re-enable manually.

---

## 9. Performance budgets

Hard targets. If we miss any of these in development, fix or revisit scope:

| Operation                                  | Budget                  | Notes |
|--------------------------------------------|-------------------------|-------|
| Initial map load (heights + splat decode)  | < 800 ms                | 104 KB heights + 1 MB splat per surface |
| Brush stroke per pointer-move              | < 4 ms                  | Includes raycast, heights write, canvas paint, texture upload |
| Idle render (no painting, no animation)    | < 8 ms / frame          | 60fps with headroom |
| Active painting render                     | < 16 ms / frame         | 60fps acceptable, 30fps minimum |
| Reset Map (full pre-bake)                  | < 1500 ms               | Acceptable to show a brief loading state |
| Clear All                                  | < 100 ms                | Should feel instant |
| Persist to disk on stroke end              | < 200 ms                | Debounced; only writes the dirty regions if we add tile-based persistence later |

Vertex count: 161×161 = 25,921 vertices. `terrainGeo.computeVertexNormals()` per frame is ~3ms. Acceptable. If it becomes a bottleneck, we can compute normals only when heights change, not every frame.

---

## 10. Persistence + interaction with the rest of Wormhole

### 10.1 Saving

- Heightmap blob writes on stroke-end (pointerup), debounced 250 ms.
- Splat textures write on stroke-end, debounced 250 ms. Only the surface that was painted writes.
- Camera view state writes on Atlas tab leave or app close.

### 10.2 Map entities (from V1 Atlas)

The existing `map_entities` table (region / settlement / landmark / district / infrastructure markers) layers **on top of** the new painted terrain. Each entity has world-XZ coords; on render we sample the heightmap at that XZ and place the entity's marker at the corresponding world Y.

Entity markers are 2D sprites in v2 (same as V1), even in 3D view. They billboard toward the camera. Future work may swap them for 3D models when zoomed in close.

### 10.3 Linking + Peek

Unchanged. Click a map entity → opens PeekPanel. Map entities can still link to characters, lore documents, etc, via the existing entity_links system.

### 10.4 Search

Unchanged. The new painting system does not introduce search-indexable text content.

---

## 11. Accessibility

- All brush/layer controls reachable via keyboard (Tab to focus, Enter / Space to activate).
- Number keys 0–4 select layers L0–L4 (matching their numbering).
- Number keys with `Shift` cycle through that layer's materials.
- `[` and `]` decrease / increase brush size by 1.
- `,` and `.` decrease / increase brush strength by 5%.
- `Ctrl+Z` / `Ctrl+Y` for undo / redo of paint strokes (stroke-level granularity, not pixel-level).
- All status text (active layer, brush info) exposed via aria-live for screen readers.

Color contrast: every layer/material color in the picker has a text label, never color-only.

---

## 12. Implementation stages (build order)

1. **R3F integration** — drop a Three.js canvas into the Atlas tab via `@react-three/fiber`. Start with the existing 2D markers re-rendered in a Three.js scene with an orthographic top-down camera. Visual parity with V1.
2. **Heightmap data path** — define the SQLite tables, add Tauri commands for read/write, hook up `useAtlasHeights` / `useAtlasSplat` Zustand-or-hook stores. No painting yet — load and render a flat heightmap.
3. **Brush + active terrain** — port the prototype's brush algorithm. Layer selector + Ground layer only (single-layer painting). Heightmap + upper splat updates work.
4. **All five layers + per-layer palettes** — extend brush to support layer switching, palette swap UI.
5. **Underground + cutaway** — second splat texture for underground floor, upper-terrain dimming, Cave Entrance cutout via `destination-out`.
6. **2D→3D zoom transition** — port the camera tilt + terrain scale interpolation from the prototype. Add the view-mode HUD pill.
7. **Map entities re-anchored to terrain** — entity markers sample heightmap to place themselves at correct Y.
8. **Persistence + undo** — stroke-end save, undo stack (cap at 50 strokes).
9. **Shader Addon scaffolding** — modal for install/manage, pack format spec, fallback path. No bundled packs yet.
10. **First reference shader pack** — internal project ships one minimal pack (animated grass + water ripples) as a reference / smoke test.

Stages 1–7 are the v2 minimum. Stages 8–10 can ship in v2.1.

---

## 13. Acceptance criteria

The feature is acceptance-ready when:

1. User can open the Atlas tab in any world and see the saved heightmap + materials.
2. Painting on each of the 5 layers does what Section 6.1 says it does.
3. Switching to Underground dims the upper terrain to 0.35 opacity within 250ms.
4. Cave Entrance material punches a visible hole the user can see the underground floor through, in both top-down and tilted views.
5. Brush size slider visibly changes the brush footprint.
6. Brush strength slider visibly changes how aggressively heights converge per stroke.
7. Reset Map restores a sensible starter island; Clear All produces a flat blank.
8. Zooming with scroll wheel smoothly transitions from flat 2D to tilted 3D — terrain rises, camera tilts, grid fades.
9. Frame rate stays ≥ 30 fps during continuous painting on the user's mid-range laptop.
10. Closing and reopening the app preserves all paint work.
11. Map entities from V1 still appear correctly positioned, sit on top of painted terrain, still open Peek on click.
12. The `Shaders` modal opens, accepts pack installs, falls back gracefully on bad packs (does not crash the Atlas).

---

## 14. Open questions (to revisit before V2 final scope-lock)

- **Per-texel layer-intent storage.** Section 6.2 describes why we omit a layer mask in v2. If the AI features (Cyber-Goggles) need to query "regions painted as Mountain", we need this. Decide in v2.1 planning.
- **Multi-pack shader stacking.** v2 says one pack at a time. Some users will want grass-from-pack-A + water-from-pack-B. Defer to v2.2.
- **Entity 3D models in immersive view.** Whether to upgrade markers → simple 3D geometry (boxes for buildings, etc) when zoomed close. v3 territory.
- **Sub-map navigation for underground.** Section 6.3 describes the cutaway-only model. If users find it confusing for sprawling cave systems, add a "switch to underground sub-map" toggle in v3.
- **Painting other layers' materials in cross-layer mode.** Today, picking Mountain only shows mountain materials. Some users might want to paint snow on a beach for "frozen coast" creative effect. Add an "all materials" toggle? Defer.

---

## 15. References

- Prototype: `prototypes/atlas-canvas-painting-prototype.html`
- Earlier 2D-to-3D transition prototype: `prototypes/atlas-canvas-3D_View-prototype.html`
- V1 Atlas spec (the system this evolves): `Initial-Specs/03_Atlas_Canvas_Build_Packet.md`
- Future feature plans note: `Future-Feature-Plans.md` (3D Atlas Canvas section)
