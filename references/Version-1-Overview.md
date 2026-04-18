# Wormhole — Version 1 Overview

A plain-English description of what **Wormhole V1** is, what it can do, and what it intentionally does not do.

> See `v1-prototype.html` in this folder for a visual walkthrough of the final V1 app.

---

## What is V1?

**Wormhole V1 is a local-first desktop worldbuilding app.** It lets a single writer or game designer build fictional worlds — characters, lore, maps, and the relationships between them — all stored as files on their own computer.

V1 is the version where **every spec in `Initial-Specs/` is fully implemented**. Nothing more, nothing less.

It is a single-player tool. No cloud, no accounts, no collaboration. Just one person, their computer, and their world.

---

## The One-Line Pitch

> A quiet place for worlds. Local-first, yours forever.

---

## Who V1 is for

- Writers building fictional settings for novels, series, or short fiction
- Game masters preparing campaigns
- Solo game designers prototyping narrative worlds
- Anyone who wants a structured-but-flexible place to keep character sheets, maps, and lore that stays on their machine

V1 is **not** for:
- Teams that need to collaborate in real time
- Users who want their data synced across multiple devices
- People looking for an AI-powered writing assistant (that comes later)
- Anyone who needs public sharing or publishing built-in

---

## The Four Core Systems

V1 is organized around four tabs, each with its own color identity:

| System | Color | Purpose |
|---|---|---|
| **Overview** | Green | Dashboard — stats and relationship graphs for the world |
| **Atlas Canvas** | Blue | 2D map — place locations, draw regions, connect them |
| **Character Codex** | Purple | Character sheets with card-based layouts and detail pages |
| **Lore Archive** | Amber | Folder-organized rich-text documents with inline linking |

Everything is connected. A character can live in a location. A lore document can reference characters. A location can be described in multiple documents. The relationships are first-class.

---

## What V1 Can Do

### Worlds
- Create, open, rename, and delete worlds
- Each world is a single `.wormhole` file the user saves wherever they want
- Worlds have a title, type, summary, and optional cover image
- The app tracks the last opened world but never stores content in the registry — only metadata

### World Overview
- See counts of characters, locations, and lore documents at a glance
- Browse three **relationship graphs** (Atlas / Characters / Lore) that show how everything connects
- Create **shared nodes** — grouping containers like "House of Valdris" that visually cluster related entities
- Drill down into any system from the overview

### Atlas Canvas (2D)
- Place locations on an infinite 2D canvas — regions, settlements, landmarks, districts, infrastructure
- Group locations into regions using shared nodes
- Draw connections between locations (roads, trade routes, rivers)
- Pan and zoom the canvas
- Search locations by name or tag
- Every location has a description, tags, and a list of linked characters and lore documents
- Paint layers for terrain/coloring (optional visual reference)

### Character Codex
- Create characters with a **front card** (portrait, name, role, ribbon, tags) and a **flip-to-back detail page**
- Characters support multiple **card layout variants** (landscape, portrait, tall)
- Detail pages have configurable **sections** — prose, grid, timeline, or cards layout
- Add **card blocks** to the front for at-a-glance stats (age, race, allegiance)
- Custom ribbon color per character
- Tag characters for filtering
- Drag to reorder the codex
- View linked records (locations, lore documents) per character

### Lore Archive
- Hierarchical **folder tree** up to 5 levels deep
- Create, rename, delete, drag-and-drop folders (with sibling reordering + reparenting)
- Rich text **TipTap editor**: H1/H2/H3, bold, italic, bullet/ordered lists, blockquotes, horizontal rules
- **Inline [[links]]** with autocomplete — type `[[` and select any character, location, or document to create a clickable reference
- Auto-save on blur, explicit save button, undo/redo
- Linked records panel — see and manage which characters and locations this document references
- Deleting a folder keeps the documents (moves them to root with a warning)

### Entity Linking
- Link any record to any other record with a **typed label** (e.g., "resident_in", "appears_in", "ruler_of")
- Links appear bidirectionally in both linked records panels
- Inline `[[links]]` in text are the same data as explicit links — no duplication
- Soft-deleting a record also soft-deletes its links; restoring the record restores them
- Links are searchable and filterable

### Global Search (Ctrl+K)
- Search across characters, locations, and lore documents from anywhere
- Results grouped by type
- Snippets show matching context
- Keyboard-navigable (arrow keys, Enter to open)

### Recycle Bin
- Deleted records are **soft-deleted** with a 24-hour recovery window
- A cleanup job runs on app startup to permanently remove anything older than 24 hours
- Accidentally deleted something? Open it from the recycle bin before the day is up

### Themes
- Dark theme (default) and light theme
- System identity colors per tab (green / blue / purple / amber)
- Theme choice persists across sessions

### Performance & Storage
- Everything runs locally — no internet required
- Each world is one SQLite file (`.wormhole`)
- Assets (images) stored as BLOBs inside the world file — the whole world is one portable file
- Fast enough for worlds with hundreds of characters, locations, and documents

---

## What V1 Cannot Do

This is deliberate. V1 stays focused by being honest about what's out of scope.

### Not in V1 — Planned for Later
- **3D Atlas Canvas** with Google Maps-style zoom-to-3D (see `Future-Feature-Plans.md`)
- **Cyber-Goggles** — AI roleplay companion for stress-testing lore decisions (see `Future-Feature-Plans.md`)
- **AI scene generation** (3D Gaussian Splatting environments inside the atlas)

### Not in V1 — Not Planned
- **Cloud sync** — Wormhole is local-first by design; your world files stay on your machine
- **Multi-user / collaboration** — single user only, no real-time editing, no sharing sessions
- **Web app** — desktop only (Windows, Mac, Linux). No browser version, no mobile version
- **Public publishing** — no "export to website" or built-in sharing. You export the file and do what you want with it
- **Version history / time machine** — no git-like history of changes. Back up the `.wormhole` file if you want snapshots
- **Plugin system** — no third-party extensions or add-ons
- **Custom scripting** — no formulas, macros, or user-writable logic
- **Import from other apps** — no Obsidian/Notion/Scrivener importers in V1

### Soft Limits
| Limit | Value |
|---|---|
| Folder nesting depth | 5 levels |
| Inline link autocomplete results | 10 per query |
| Recycle bin retention | 24 hours |
| Undo/redo stack (per session) | ~50 steps |
| Max practical world size | ~500-1000 records (soft — depends on hardware) |

### Deliberate Design Choices
- **Only one world open at a time** — simplifies state and reduces confusion
- **No auto-backup** — the user controls where their file lives and how to back it up
- **No telemetry** — the app doesn't phone home. It has no network code at all
- **Rich text is stored as JSON**, not Markdown — TipTap's native format, richer and more editor-friendly
- **Soft-delete is the default** — accidents are recoverable for 24 hours; permanent deletion takes explicit action

---

## Technical Foundation

For reference, V1 is built on:

- **Tauri 2** — the desktop app shell (Rust backend + web frontend)
- **React 19** + **TypeScript** + **Vite 7** — the frontend
- **Rust** + **rusqlite** — the backend and database layer
- **SQLite** — per-world storage, one file per world
- **Zustand** — lightweight state management in the frontend
- **TipTap 3** — the rich text editor
- **D3** (`d3-zoom`, `d3-selection`) — the graph and canvas rendering

No cloud services. No analytics. No external dependencies at runtime beyond the app itself.

---

## Getting Started (when V1 ships)

1. **Download** the app for your OS (Windows / Mac / Linux)
2. **Pick a storage folder** where your world files will live (Documents, iCloud Drive, Dropbox — your call)
3. **Create a world** or open an existing `.wormhole` file
4. **Build** — start with characters, lore, or a map. Everything links to everything.

There is no account to create. There is nothing to sign up for. The app opens and you start writing.

---

## V1 Philosophy in One Paragraph

Wormhole V1 is a single-player worldbuilding app that believes your worlds belong to you. It does not optimize for engagement, collaboration, or growth. It optimizes for one writer, alone with their notebook and their imagination, building something that will last because it lives on their own hard drive. Everything else — AI, 3D, collaboration — is a future conversation. V1 is about getting the foundation right.
