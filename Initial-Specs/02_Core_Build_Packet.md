# Packet 2 — Core Build Packet

> **Status:** Built (V1). Stack, two-database architecture, soft-delete, asset BLOB pipeline, and migration system all implemented per spec. Last verified 2026-04-26.

## 1. Purpose of this packet
This packet defines the shared implementation foundation for Wormhole V1:
- stack
- architecture
- data source of truth
- routes
- project structure
- persistence rules
- global constraints

## 2. Stack
Use:
- **Tauri 2**
- **React**
- **TypeScript**
- **Vite**
- **Rust**
- **SQLite**
- **TipTap** (ProseMirror-based) — rich text editor component
- **D3-force** or equivalent — lightweight force-directed graph for World Overview

## 3. Architecture
### Frontend responsibilities
- render UI
- screen composition
- form state
- tab state
- dialog flows
- invoke backend commands
- local view selection state

### Backend responsibilities
- SQLite initialization
- migrations
- CRUD commands
- asset import/copy handling
- data integrity rules
- search queries

### Source of truth
SQLite is the source of truth for:
- worlds
- map entities
- characters
- character_card_blocks
- character_detail_sections
- lore folders
- lore documents
- entity links
- assets

## 4. App shell
### Top-level entry
The app opens at **World Index**.

### Inside a world
The world shell contains a **top dock** with these tabs:
- Overview
- Atlas Canvas
- Character Codex
- Lore Archive

No sidebar is required for primary navigation.

## 5. Project structure
Use this or a very close equivalent:

```text
src/
  app/
    App.tsx
    routes.tsx
    providers.tsx
  components/
    common/
    worlds/
    atlas/
    characters/
    lore/
  features/
    worlds/
    atlas/
    characters/
    lore/
    links/
    assets/
    search/
  lib/
  state/
  styles/
src-tauri/
  src/
    main.rs
    db.rs
    migrations.rs
    commands/
      worlds.rs
      atlas.rs
      characters.rs
      character_blocks.rs
      character_sections.rs
      lore.rs
      links.rs
      assets.rs
      search.rs
```

## 6. Global screen structure
### World Index
- create world
- edit world
- delete world
- open world

### World Overview
- title
- summary
- counts
- quick actions
- system previews

### Atlas Canvas
- map background
- placed entities
- selected entity panel

### Character Codex
- character list
- character detail

### Lore Archive
- folder tree
- document editor
- linked records panel

## 7. Global data entities
Use these first-class tables/entities:
- worlds (includes genre/world_type for tag suggestions)
- assets
- map_entities
- characters
- character_card_blocks (grid blocks on the character card page)
- character_detail_sections (tabbed panels on the character details page)
- lore_folders
- lore_documents
- entity_links
- canvas_paint_layers (raster data for freehand region coloring in Atlas)

Entities that support soft-delete (recycle bin) must include a `deleted_at` nullable timestamp column:
- characters
- map_entities
- lore_documents
- lore_folders
- entity_links (soft-deleted alongside their parent record)

Do not add new first-class entities in V1 unless absolutely necessary.

## 8. Shared behaviors
### IDs
Use UUIDs or equivalent stable unique IDs.

### Timestamps
Use created_at and updated_at consistently.

### Deletion rules
Deleting a **world** permanently removes the `.wormhole` file after explicit confirmation. This is not recoverable via recycle bin.

Deleting a **character, map entity, lore document, or lore folder** sets the `deleted_at` timestamp on the record (soft-delete). Related `entity_links` are also soft-deleted in the same database transaction by setting their `deleted_at` timestamps.

Deleting a **lore folder** does NOT delete its documents. Documents inside the folder are moved to the root level (folder_id set to NULL). The user sees a warning: "This folder contains X documents. They will be moved to root."

Recycle bin rules:
- each world has its own recycle bin
- soft-deleted records are recoverable for 24 hours from deletion time
- a **cleanup job runs on every app startup**: it permanently deletes any records where `deleted_at` is older than 24 hours
- the user may also manually empty the recycle bin or permanently delete individual items
- soft-deleted records are excluded from search results, linked records panels, inline link autocomplete, and record counts
- restoring a record also restores its soft-deleted entity links (same transaction)

### Confirmation rules
Deletion must always require confirmation.

## 9. Storage architecture
Each world is stored as a single `.wormhole` file.

A `.wormhole` file is a **SQLite database**. Assets (images, map backgrounds, canvas paint layers) are stored as **BLOBs in an `assets` table** within the same database. This means the entire world — data and media — is a single portable file.

The file extension is `.wormhole` but the internal format is standard SQLite, recoverable with any SQLite tool (DB Browser for SQLite, `sqlite3` CLI, Python scripts, etc.).

### Registry
The app maintains a lightweight **registry database** (separate from world files, stored in the system app-data folder) that tracks:
- known world file paths
- last opened timestamps
- world metadata cache (title, cover thumbnail) for the World Index

### User data location
On first launch, the user chooses where world files are stored:
- **Option A**: pick a folder (e.g. `~/Documents/Wormhole/`)
- **Option B**: use the system default app-data folder

The chosen folder must have a clear, recognizable name so the user understands what it is and does not accidentally delete it.

The user may also open `.wormhole` files from arbitrary locations (drag-and-drop or file picker), at which point the registry adds the new path.

### Backup and portability
- Backing up a world = copying the `.wormhole` file
- Sharing a world = sending the `.wormhole` file
- All assets are embedded as BLOBs, so no external file references break when moving the file
- The data inside is recoverable with standard SQLite tools even without the app

## 10. Asset strategy
Supported asset types:
- world cover
- character image
- map background

Asset import behavior:
1. user selects file
2. file is copied into the `.wormhole` file's asset storage
3. asset record is created in the world's DB
4. entity references the asset record

## 11. Search baseline
V1 search must support searching by title/name across:
- world titles
- map entity titles
- character names
- lore document titles

Search is **case-insensitive substring matching**. Results are sorted alphabetically by title. Maximum **50 results** returned per query. Soft-deleted records (in recycle bin) are excluded from results.

Each result displays: record type label (e.g. "Character," "Map Entity"), full title, and a short snippet (first 50 characters of description/summary for lore docs and characters, empty for others).

Selecting a result opens the relevant detail view/panel.

Full-text search of lore document content and character summaries is **deferred to V2**.

## 12. State management
Use:
- local component state for forms and local UI
- a lightweight global store for:
  - selected world
  - active tab
  - selected map entity
  - selected character
  - selected lore document
  - modal/dialog state

Do not overbuild a large global state container for all persisted entity data.

## 13. Routing strategy
Minimal route model:
- `/` = World Index
- `/world/:worldId` = world shell

Inside the world shell, tab state controls:
- Overview
- Atlas Canvas
- Character Codex
- Lore Archive

## 14. Data integrity rules
- Lore docs are content records, not the backing store for structured entities
- Decorative UI must not carry hidden logic
- All cross-system relationships must go through the entity link model
- CRUD must be implemented through backend commands, not frontend-local fake persistence

## 15. Global constraints
Do not implement:
- auth
- cloud sync
- collaboration
- plugin architecture
- animation systems
- drawing systems
- general-purpose note app scope

## 16. Build order
Recommended order:
1. app shell + database init
2. World Index + World Overview
3. Character Codex
4. Lore Archive
5. Atlas Canvas
6. Linking
7. Search + polish

## 17. Definition of a good scaffold
A good scaffold is not just a UI mock.
It must include:
- working DB init
- working CRUD commands
- actual persistence
- a coherent world shell
- seed/example content for development

## 18. Rich text editor
All longform text fields in Wormhole use a shared rich text editor component based on TipTap (ProseMirror).

This applies to:
- lore document content
- character card block content (in `character_card_blocks`)
- character detail section content (in `character_detail_sections`, for prose layout type)
- character objective summary
- character in-character intro
- map entity description

The editor must support:
- headings
- bold, italic
- bullet lists, numbered lists
- inline links (see section 19)
- clean rendering as-you-type (not raw markdown syntax)

The editor stores content as a **JSON document tree** (ProseMirror/TipTap native format), not as a raw markdown string. This enables structured inline link resolution and rich rendering.

### Plain text exceptions
These fields remain plain text inputs (no rich editor):
- character name
- character short_role
- map entity title
- lore document title
- lore folder title
- world title
- tag inputs
- any single-line label or identifier field

## 19. Inline links
Any rich text field supports `[[inline links]]` to other records. This is a single shared component reused across all rich text editors in the app.

### Behavior
1. User types `[[`
2. An autocomplete dropdown appears showing matching records (characters, map entities, lore documents) from the current world
3. The dropdown filters as the user continues typing (case-insensitive substring match, max 10 results)
4. User may:
   - **(a)** Select a record from the dropdown — creates a structured link node
   - **(b)** Press **Escape** to dismiss the dropdown — `[[` remains as literal text
   - **(c)** Click away from the dropdown — dismisses it, `[[` remains as literal text
5. A selected link resolves to a clickable reference in the rendered text

### Rules
- The autocomplete dropdown does not block typing — the user can type freely and the dropdown filters live
- Links are stored as structured nodes in the rich text JSON (with record type + record ID), not as raw text patterns
- Clicking an inline link in **view mode** opens a read-only peek panel (see UX packet section 14)
- Clicking an inline link in **edit mode** selects the link node for editing (change target or delete)
- If the linked record is deleted (in recycle bin or permanently), the link renders as grayed-out text with a tooltip "Record deleted"
- Inline links only search non-deleted records within the current world

## 20. Undo and redo
### Rich text editing
The TipTap editor provides built-in undo/redo (Ctrl+Z / Ctrl+Shift+Z) for all text editing operations. This covers lore documents, character text fields, and map entity descriptions.

### Structured field editing
Undo/redo for non-text fields (changing a character's short_role, modifying map entity coordinates, etc.) is not required in V1. The confirmation dialog on destructive actions is sufficient.

### Deleted records — Recycle bin
Deleted records (characters, map entities, lore documents, lore folders) are not immediately destroyed. They move to a **per-world recycle bin**.

Recycle bin rules:
- each world has its own recycle bin
- deleted records remain recoverable for **24 hours**
- after 24 hours, records are permanently deleted
- the user may also manually empty the recycle bin or permanently delete individual items from it
- records in the recycle bin do not appear in search, linked records panels, or autocomplete
- restoring a record also restores its entity links (links are soft-deleted alongside the record)

The recycle bin is stored within the world's `.wormhole` database using a soft-delete pattern (a `deleted_at` timestamp on each table). The cleanup job runs on every app startup and permanently deletes records where `deleted_at` is older than 24 hours.

### Undo/redo in rich text
Undo stack is in-memory per editor session. Cleared when the document is saved or the app closes. Auto-save triggers on blur (when user clicks away from the editor). An explicit save button is also available. Max 50 undo levels per session.

## 21. Theme system
### V1 scope
V1 ships with two built-in themes:
- **dark** (default)
- **light**

A toggle in the top dock or app settings switches between them. Theme choice is global (applies to entire app, not per-world) and persists across app restarts. Entity colors (character ribbon, map paint colors) retain their original hue in both themes.

### Future scope (not V1)
Custom theme import via a structured theme file. The app will provide a template format and a preview before applying. This is deferred to a later version.

## 22. Tag system
### Tag input behavior
Tags on characters and map entities are **freeform text** — the user types whatever they want.

### Tag suggestions
When the user creates a world, they select a **genre or world type** (e.g., Fantasy, Sci-Fi, Historical, Modern, Horror, or Custom). The app provides a **predefined suggestion dictionary** per genre that appears as autocomplete hints when typing tags.

Examples for Fantasy: warrior, mage, elf, orc, dragon, kingdom, tavern, guild, etc.

Suggestions are non-binding — the user may ignore them entirely and type anything.

### Tag normalization
Tags are stored as lowercase with leading/trailing whitespace trimmed. Internal multiple spaces are collapsed to single spaces. Max tag length: 50 characters. Allowed characters: alphanumeric, space, hyphen, underscore. Duplicate tags (after normalization) are prevented at the database level.

### Tag scope
Both characters and map entities support optional freeform tags. Tags are searchable and filterable within the character list and map entity list.
