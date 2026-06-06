
# Wormhole Engine: Core Map & Systems Architecture Blueprint

## 1. Architectural Decision Record: 2D Atlas Canvas Rendering & Initialization Baseline
**Status:** Adopted

### Context & Problem
The Atlas Canvas requires a 2D orthographic map view and a 3D terrain view to remain perfectly synchronized. Initial implementations using pixel-based canvas layouts and distance transforms introduced massive scaling artifacts (e.g., 1:5 scale distortion) and broke raw numeric portability. Utilizing full WebGL instances for simple 2D operations introduced massive VRAM overhead, making the tool inefficient for long lore-writing sessions on lightweight hardware.

### The Solution: Grid Data + Marching Squares (D3 Contour)
The application abandons all pixel-buffered manipulation. The absolute Single Source of Truth for the world is an immutable array pair representing a uniform grid. 

#### The World Initialization Baseline
When a new project is created, the grid is allocated to a user-defined size (e.g., 2,000 x 2,000 cells) and instantly flooded with a **Deep Ocean Baseline**. 

| Array Type | Data Type | Default Value | System Significance |
| :--- | :--- | :--- | :--- |
| **Elevation Grid** | `Float32Array` | `-10.0` | Deep-sea floor bed located well below the Sea-Level Constant (Y=0.0). |
| **Material Grid** | `Uint8Array` | `0` | Hardcoded material map index point representing `MATERIAL_DEEP_OCEAN`. |

Because the global Sea Level is fixed at `0.0`, initializing the entire array to `-10.0` means the 2D view naturally registers no dry land contours, and the 3D view renders a flat, uniform water plane resting over a sunken ocean bed.

#### The 2D Representation Layer
To display this grid top-down without WebGL, the engine feeds the `Float32Array` directly into `d3-contour` (Marching Squares). Isolines are generated deterministically based on key threshold levels:

* **Isoline < 0.0:** Shallow water shelves and trenches.
* **Isoline = 0.0:** The absolute mathematical coastline.
* **Isoline > 0.0:** Inland topographical elevation contours (hills, mountains).

The resulting continuous vector paths are painted straight to a lightweight HTML5 `<canvas>` using standard path-drawing methods.

---

## 2. Technical Directive: Array-to-Vector Linking (Marching Squares)
**Status:** Adopted

### Context & Problem
The Surface data exists strictly as a discrete grid of floating-point numbers (`Float32Array`). Rendering this data directly pixel-by-pixel results in a blocky, retro aesthetic that does not fit the intended visual style. We need a performant way to "link" these discrete data points into smooth, organic boundary lines (coastlines, biomes) without relying on GPU pixel shaders.

### The Mechanism: Isoline Generation
The engine uses the **Marching Squares algorithm** (implemented via `d3-contour`) to act as the mathematical bridge between the raw numerical array and the visual vector graphics. 

1. **Neighborhood Scanning:** The algorithm processes the grid in 2x2 cell chunks.
2. **Linear Interpolation:** It compares adjacent cell values against defined thresholds (e.g., Sea Level at `0.0`). If Cell A is `0.5` (Land) and Cell B is `-0.5` (Deep Water), the algorithm calculates the exact physical midpoint where the value crosses `0.0`.
3. **Vector Linking:** It connects (links) these interpolated crossing points across the entire 10,000x10,000 grid. This process generates perfectly continuous, closed vector shapes (GeoJSON polygons) representing the organic boundaries of the terrain.

### Implementation Rule
The 2D React view must never attempt to render the `Float32Array` directly to a canvas pixel buffer. It must pass the array through the contour generator, which outputs the linked vector coordinates. The frontend then renders these coordinates strictly as SVG `<path>` elements or Canvas API bezier curves. This guarantees infinite zoom fidelity and maintains the zero-VRAM architecture.

---

## 3. Architectural Decision Record: 3-Tier Layered World Data & Asset Management
**Status:** Adopted

### Context & Problem
Users require full structural freedom to create layered worlds containing subterranean cavern networks (Underground) and floating structures or landmarks (Sky). Using a single 2.5D heightmap makes it impossible to stack multiple distinct floors over a single coordinate point. Conversely, moving the entire world engine to a 3D voxel grid would degrade processing performance and balloon database storage with redundant entries.

### The Solution: Decoupled Multi-Data Structure Pipeline
Wormhole isolates data structures by matching each environmental region to the storage shape that naturally fits its physical behavior.

```text
       [ SKY LAYER ]         --->   Sparse Entity JSON Array (Objects/Pins)
--------------------------------------------------------------------------------- Sea Level Ceiling
     [ SURFACE LAYER ]       --->   Dense 2.5D Grids (Float32/Uint8 Arrays)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Sea Level 0.0
  [ OCEAN FLOOR / CRUST ]    --->   Lower bounds of the Surface Heightmap
--------------------------------------------------------------------------------- Crust Bedrock
   [ UNDERGROUND LAYER ]     --->   Subtractive Node Graph JSON (Carvings/Tunnels)

```

### Region Specifications & Architectural Schema

#### A. The Surface Layer (Dense Matrix)

* **Physical Boundary:** Captures everything from the deepest ocean trenches up to the highest mountain peaks. The "Ocean Floor" is simply a negative elevation value on the Surface grid, not a separate layer.
* **Data Layout:** Binary `Float32Array` (Elevation) + `Uint8Array` (Material Lookup IDs).
* **Material Dictionary Example:**
* `0`: Deep Ocean
* `1`: Shallow Coast
* `2`: Sand/Beach
* `3`: Grassy Plains
* `4`: Exposed Mountain Rock



#### B. The Sky Layer (Sparse Object List)

* **Physical Boundary:** Open space above the highest possible landmass ceiling.
* **Data Layout:** A flat JSON Array containing discrete object structures.
* **Database Record Schema:**
```json
{
  "id": "sky_ent_08a7",
  "type": "landmark",
  "name": "Floating Spire",
  "coordinate": { "x": 1420.5, "y": 75.0, "z": 810.3 },
  "assets": {
    "mesh_3d": "models/spire_tower.glb",
    "icon_2d": "ui/icons/pin_tower.svg"
  }
}

```



#### C. The Underground Layer (Subtractive Node Graph)

* **Physical Boundary:** Subterranean hollow voids carved out below the Surface layer's crust.
* **Data Layout:** An interconnected JSON graph tracking subtractive spherical volumes.
* **Database Record Schema:**
```json
{
  "node_id": "ug_node_991",
  "coordinate": { "x": 512.0, "y": -35.0, "z": 1024.0 },
  "radius": 12.5,
  "links_to": ["ug_node_992"],
  "breaks_surface": true
}

```


* **3D Engine Processing:** The 3D view feeds the surface mesh and the underground node array into a Constructive Solid Geometry (CSG) compiler. If `breaks_surface` evaluates to `true`, the engine punches a hole through the terrain mesh at those exact coordinates to smoothly blend the cave entrance.

### Asset Storage Strategy (The Portable Companion Vault)

To keep the primary `.wormhole` SQLite project files transportable, zero heavy asset binaries are saved inside the database.

1. Custom user models (`.glb`, `.gltf`) are copied into a localized directory folder managed by the Tauri file system (e.g., `/project_name_assets/`).
2. The SQLite database records hold only small, explicit string references to those relative file paths.
3. If an asset directory is missing (e.g., sharing a raw project database file via email), the engine falls back to default placeholder icons in 2D and simple bounding boxes in 3D, keeping data integrity intact.

---

## 4. Technical Directive: Viewport Coordinate Translation Math

**Status:** Required for Implementation

### Context & Problem

Because the 2D user viewport handles dynamic canvas transformations (pan offsets and scale changes driven by `d3-zoom`), raw mouse event screen positions (`clientX/Y`) do not map accurately to the underlying world array coordinates. Without translation, brush strokes will drift, warp, or corrupt adjacent cells when the user interacts with the canvas while zoomed.

### The Solution: Deterministic Viewport Inversion Pipeline

Every interaction tool must process pointer input coordinates through a unified translation function before mutating any underlying grid data.

```text
[Screen Mouse Position (clientX, clientY)]
                   │
                   ▼
[Canvas Local Space via Bounding Client Rect]
                   │
                   ▼
[Apply Inverted Zoom Matrix (Subtract Pan Offset / Divide by Scale Factor)]
                   │
                   ▼
[World-Space Continuous Units (Float32)]
                   │
                   ▼
[Math.floor Execution]
                   │
                   ▼
[Final Target Grid Indices (Array X, Array Z)]

```

### Strict Reference Math

Given a pointer event `E`, a bounding client rect `R`, and an active D3 Zoom Transform state `T` (consisting of `T.x` as X-pan, `T.y` as Y-pan, and `T.k` as the current scale multiplier):

`World_x = ((E.clientX - R.left) - T.x) / T.k`
`World_z = ((E.clientY - R.top) - T.y) / T.k`
`GridIndex_x = Math.floor(World_x)`
`GridIndex_z = Math.floor(World_z)`

### Implementation Rule

Tool implementations are completely forbidden from writing inline coordinate conversion formulas. All canvas modules must call a central, highly optimized utility to parse coordinates uniformly, guaranteeing absolute alignment across both the 2D painting brushes and the 3D rendering engine.

```

```