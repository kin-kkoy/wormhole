# Wormhole — Codebase Overview

> A complete, self-contained explanation of this codebase for any human or AI reader.
> You should be able to understand the entire app from this document without opening
> a single source file. Last updated: **2026-06-12** (branch `CharacterCodex-polishing`).

---

## Table of Contents

1. [What Wormhole Is](#1-what-wormhole-is)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [The Backend (Rust / Tauri)](#4-the-backend-rust--tauri)
5. [The Frontend (React / TypeScript)](#5-the-frontend-react--typescript)
6. [The Four Systems](#6-the-four-systems)
7. [Cross-System Infrastructure](#7-cross-system-infrastructure)
8. [Typography System](#8-typography-system)
9. [Theming & Visual Identity](#9-theming--visual-identity)
10. [Implementation Status — What's Built](#10-implementation-status--whats-built)
11. [What Needs Fixing / Known Issues](#11-what-needs-fixing--known-issues)
12. [Planned / Future Features](#12-planned--future-features)
13. [Critical Conventions & Gotchas](#13-critical-conventions--gotchas)
14. [Repository Map](#14-repository-map)
15. [Running the App](#15-running-the-app)

---

## 1. What Wormhole Is

**Wormhole is a local-first desktop worldbuilding application.** It is built for a
single user (no accounts, no cloud, no collaboration) who wants to build fictional
worlds — characters, lore, and eventually maps — on their own machine, fully offline.

A user creates **Worlds**. Each world is a self-contained file on disk. Inside a
world there are three (eventually four) systems:

| System | Status | What it is |
|---|---|---|
| **Overview** | ✅ Shipped | Three-tab relationship-graph dashboard for the world |
| **Atlas Canvas** | 🚧 Detached (placeholder) | Map system — removed 2026-06-06 for ground-up redesign |
| **Character Codex** | ✅ Shipped | Two-sided character cards (collectible-card front + dossier back) |
| **Lore Archive** | ✅ Shipped | Folder-organized rich-text documents + a book-styled "Read Mode" |

Everything is interconnected through a shared **entity-linking** system: characters
link to lore documents, inline `[[links]]` live inside rich text, and a peek panel
lets you preview any linked record without leaving your current context.

**What Wormhole deliberately is NOT:** a page-builder, a game engine, an
Obsidian clone, or a collaborative tool. V1 scope is intentionally bounded.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | **Tauri 2** (Rust backend + system webview; WebKitGTK on Linux) |
| UI | **React 19** + **TypeScript**, built with **Vite 7** |
| State | **Zustand** (single store, `src/state/store.ts`) |
| Database | **SQLite** via **rusqlite** (Rust side only — frontend never touches SQL) |
| Rich text | **TipTap** (ProseMirror wrapper); content stored as TipTap JSON |
| Graphs | **D3** (`d3-zoom`, `d3-selection`) for pan/zoom; custom deterministic layout (no physics) |
| Persistence of UI prefs | Tauri **Store plugin** (`src/lib/settings-store.ts`) |
| Fonts | 11 bundled OFL families, served locally (`src/assets/fonts/fonts.css`, ~1.7 MB) — offline-first, no webfont fetch. Chrome speaks ONE voice: iA Writer Quattro (Option E, 2026-06-11) |

---

## 3. High-Level Architecture

### 3.1 The two-database model

This is the most important architectural decision in the app:

1. **Registry DB** (`registry.db`, lives in the OS app-data dir):
   A small bookkeeping database. It tracks *where world files live* plus a
   metadata cache for the world index screen (title, summary, world_type,
   cover_thumbnail BLOB). It **never stores world content**.

2. **World DBs** (`*.wormhole` files, in a user-chosen storage folder):
   One SQLite file per world, containing **everything** — characters, lore,
   links, and even image assets stored as BLOBs. A world file is fully
   portable: copy it to another machine and it just works.

Only **one world can be open at a time**. The Rust struct `AppDatabase`
(`src-tauri/src/db.rs`) holds the always-open registry connection plus an
`Option<active_world>` connection that is swapped when the user opens/closes
a world.

### 3.2 Data flow

```
React component
   → typed wrapper in src/lib/commands.ts
      → Tauri invoke (IPC)
         → Rust command in src-tauri/src/commands/<domain>.rs
            → rusqlite against registry.db or the active .wormhole file
```

**Rule: ALL CRUD goes through Tauri commands.** There is no frontend-local
persistence of content, ever. The frontend is a pure view layer over the Rust API.

### 3.3 Routing

Defined in `src/app/routes.tsx`:

- `/` → `WorldIndex` (`src/features/worlds/WorldIndex.tsx`) — the world picker/launcher
- `/world/:worldId` → `WorldShell` (`src/features/worlds/WorldShell.tsx`) — opens the
  world and renders the tab bar (Overview / Atlas / Characters / Lore)

**Tab state lives in Zustand, not the URL.** Switching tabs does not navigate.

---

## 4. The Backend (Rust / Tauri)

All Rust code lives in `src-tauri/src/`.

### 4.1 Core files

- **`main.rs`** — thin entry point; calls into `lib.rs`.
- **`lib.rs`** — Tauri app builder. Registers every command in
  `invoke_handler` (currently ~70 commands across 9 domains) and sets up
  managed state (`AppDatabase`). Startup also triggers recycle-bin cleanup
  (records soft-deleted >24h ago are purged).
- **`db.rs`** — `AppDatabase`: registry connection + optional `active_world`
  connection. Helper methods for getting the active world or erroring cleanly.
- **`migrations.rs`** — version-tracked migration runner with **two separate
  tracks**: registry (currently **v3** — 003 adds `last_position` for the resume
  pill) and world (currently **v17**). SQL files live in
  `src-tauri/src/migrations/registry/` and `src-tauri/src/migrations/world/`.

### 4.2 World schema (current, after migration 015)

Tables in a `.wormhole` file:

| Table | Purpose |
|---|---|
| `worlds` | The world's own metadata (single row) |
| `assets` | Images as BLOBs (id, mime, bytes) |
| `characters` | Character records (name, tags, ribbon color, intro, cinematic lock, sort order, `deleted_at`) |
| `character_card_blocks` | Blocks placed on the card-front 3×7 grid (type, position, size, content) |
| `character_detail_sections` | Tabbed sections on the details back (layout type + JSON content) |
| `lore_folders` | Nested folder tree (`deleted_at` soft-delete) |
| `lore_documents` | Documents: TipTap JSON content + `typography_overrides_json` (`deleted_at` soft-delete) |
| `entity_links` | Bidirectional links between any two entities (single row per link, `deleted_at`) |
| `next_page_links` | Per-document "Next page" overrides for Read Mode cross-doc navigation |
| (shared-node tables) | Overview graph shared/group nodes (migration 002) |

**Migration history worth knowing** (`src-tauri/src/migrations/world/`):
- `001_init.sql` — core schema
- `002_graph_shared_nodes.sql` — Overview shared nodes
- `003`, `008`, `010` — Atlas tables (all since dropped)
- `004_card_block_type.sql`, `005_cinematic_preview.sql`, `007_character_lock_face.sql` — Character Codex evolution
- `006_drop_dead_character_columns.sql` — cleanup
- `009_lore_doc_typography.sql` — per-document typography overrides
- `011_detach_atlas.sql` — **drops ALL atlas tables** (the Atlas detachment)
- Migration v12 — a **Rust-side data pass** in `migrations.rs` (not a SQL file): rewrites stale inline `[[links]]` that pointed at deleted map entities into plain text across all stored TipTap JSON, so no dead references survive the Atlas removal.
- `013_character_shelves.sql`, `014_ribbon_icon.sql`, `015_shelf_icon.sql` — Character Codex shelves + ribbon/shelf icon columns.
- `016_lore_doc_status.sql` — `lore_documents.status` (`stub|draft|wip|done`, default draft) for the folder-tree status dots.
- `017_read_progress.sql` — `read_progress` table (per-doc `read_at` + `bookmarked`) backing Read Mode's TOC read dots and bookmark ribbon.

### 4.3 Command domains (`src-tauri/src/commands/`)

One file per domain; all registered in `lib.rs`:

- **`worlds.rs`** — app config, storage folder, world CRUD, open/close world,
  seed example world, `get_world_overview`.
- **`assets.rs`** — `import_asset`, `get_asset`, and the important one:
  **`get_asset_bytes`**, which returns raw binary via `tauri::ipc::Response`
  (no base64 encoding overhead — images go over IPC as raw bytes).
- **`characters.rs`** — character CRUD + soft-delete lifecycle
  (`delete`/`restore`/`purge`/`list_deleted`) + `reorder_characters`.
- **`character_blocks.rs`** — card-front block CRUD +
  `batch_update_block_positions` (one call when the user rearranges the grid).
- **`character_sections.rs`** — detail-section CRUD + reorder. Note: in-section
  *entry* reordering has **no dedicated command** — the frontend reorders the
  JSON and writes back through `update_detail_section`.
- **`lore.rs`** — folder CRUD (rename, move, reorder, doc-count), document CRUD,
  `update_document_typography`, soft-delete lifecycle for both folders and docs.
  Deleting a folder moves its documents to root (no cascading doc deletion).
- **`links.rs`** — entity link CRUD, `search_linkable_records` (powers the link
  picker and `[[` autocomplete), `resolve_inline_links` (powers the broken-link
  resolver), and the `next_page_links` get/set/list trio.
- **`search.rs`** — `search_world`, the global search backing the Overview search bar.
- **`graph.rs`** — graph data for the Overview tabs (`get_characters_graph_data`,
  `get_lore_graph_data`), shared-node CRUD, `auto_detect_shared_nodes`
  (finds candidate groupings automatically), and `get_asset_batch` (bulk image
  fetch for graph thumbnails).

### 4.4 Key backend behaviors

- **Soft-delete everywhere**: `deleted_at` column on characters, lore_documents,
  lore_folders, entity_links. Deleting an entity co-deletes its links *in the
  same transaction*; restoring restores them. Hard purge happens on explicit
  user action or 24h-expiry cleanup at app startup.
- **UUIDs** for all entity IDs.
- **Server-side validation mirrors client rules** — e.g., the card grid's
  "non-multi block presets can only appear once" rule is enforced in both
  `CardGrid.tsx` and `character_blocks.rs`.

---

## 5. The Frontend (React / TypeScript)

All frontend code lives in `src/`.

### 5.1 Directory philosophy

- **`src/features/<domain>/`** — top-level UIs (whole screens / tab contents).
- **`src/components/<domain>/`** — reusable building blocks consumed by features.
- **`src/lib/`** — pure logic, no React (commands, layout math, conversions, catalogs).
- **`src/hooks/`** — shared React hooks.
- **`src/state/store.ts`** — the single Zustand store.
- **`src/styles/`** — global CSS, theme tokens, typography tokens.
- **`src/app/`** — `App.tsx`, `providers.tsx`, `routes.tsx`.

### 5.2 The Zustand store (`src/state/store.ts`)

One store holds all cross-cutting UI state:
`worlds`, `activeWorld`, `activeTab` (Overview/Atlas/Characters/Lore),
`overviewTab` (which graph tab is shown), `editMode`, `selectedCharacterId`,
`cardFlipped` (card front vs. details back), `peekTarget` (what the peek panel
shows), `loreMode` (write vs. read), `readerLayout` (continuous vs. paginated),
`activeFolderPath`, `selectedDocumentId`, `tocCollapsed`.

Local component state stays local; the store is only for state that multiple
features need or that must survive tab switches.

### 5.3 `src/lib/` — pure logic modules

- **`commands.ts`** — typed wrappers around every Tauri `invoke`. This is the
  ONLY place the frontend calls the backend. Also exports
  `withLinkInvalidation()`, which wraps delete/restore commands so the
  broken-link resolver re-scans after destructive operations.
- **`graph-layout.ts`** — deterministic **radial tree layout** for the Overview
  graphs. No physics simulation, no randomness: same data → same layout, every time.
- **`section-conversion.ts`** — the pure conversion matrix for changing a detail
  section's layout (prose ↔ cards ↔ timeline ↔ key-value). Knows which
  conversions are lossy and produces the plaintext dump shown for lossy ones.
- **`font-catalog.ts`** — single source of truth for fonts (see §8).
- **`typography-core.ts`** — the `makeTypography()` factory (see §8).
- **`settings-store.ts`** — Tauri Store plugin wrapper for persisted UI prefs (theme, typography).

### 5.4 `src/hooks/`

- **`useImageCache.ts`** — module-scope **singleton** cache. Fetches image bytes
  via the binary IPC command `get_asset_bytes`, converts to Blob URLs, caches
  them. `primeImageCache` / `clearImageCache` manage lifetime. Every image in
  the app goes through this.
- **`useGraphDrag.ts`** — drag behavior for graph nodes.
- **`useCharacterTypography.ts`** / **`useLoreTypography.ts`** — thin
  instantiations of the generic typography engine for each system.

---

## 6. The Four Systems

### 6.1 World Index & World Shell

- **`src/features/worlds/WorldIndex.tsx`** — the launcher at `/`. Lists worlds
  from the registry (with cached cover thumbnails), creates new worlds
  (`src/components/worlds/WorldFormDialog.tsx` — includes genre-based tag
  suggestions), sets the storage folder, can seed an example world.
  **Resume pill (2026-06-11):** when a world's registry row has a
  `last_position` snapshot pointing at a character/lore doc, an amber
  "Resume …" pill renders below the card's existing text (the orb/sphere is
  untouched). Clicking stages `pendingResume` in the Zustand store, then
  navigates; **`setActiveWorld` consumes it internally** (worldId-scoped,
  8s freshness window, NOT cleared on use) — it must be consumed there
  because `setActiveWorld` resets tab/selection state, and StrictMode's
  double mount makes `open_world` resolve twice, so any external one-shot
  application gets clobbered. The snapshot is written debounced (~800ms)
  from `WorldShell` on every tab/selection change via
  `update_last_position`, which resolves the entity's title from the open
  world DB.
- **`src/features/worlds/WorldShell.tsx`** — wraps an open world: renders the
  **TopDock** (`src/components/common/TopDock.tsx`) with the four system tabs
  and mounts the active system. Opening the shell calls `open_world`; leaving
  closes it.

### 6.2 Overview (the three-tab graph system)

**Important historical note:** the original spec (Packet 7) described a
single force-directed graph with a root world node, plus a "dashboard" card
view. **Neither shipped.** After design iteration, the established pattern is a
**three-tab graph system** — treat this as canon, not the spec text.

- **`src/features/worlds/WorldOverview.tsx`** + **`src/components/worlds/OverviewTabSelector.tsx`** —
  tab selector for Atlas / Characters / Lore sub-views (`overviewTab` in Zustand).
- **`src/components/worlds/graph/CharactersGraph.tsx`** and **`LoreGraph.tsx`** —
  dedicated relationship graphs per system. The Atlas sub-tab currently renders
  the in-development placeholder.
- **`GraphCanvas.tsx`** — shared D3 zoom/pan canvas hosting the nodes.
- **`ImageNode.tsx`**, **`GraphLink.tsx`**, **`HoverLabel.tsx`** — node/edge/label primitives.
- **`SharedNode.tsx`** + **`SharedNodeModal.tsx`** — "shared nodes": user-created
  group nodes that cluster related entities (e.g., a faction). Backend supports
  auto-detection (`graph::auto_detect_shared_nodes`).
- **`EditDockPanel.tsx`** — graph edit-mode dock.
- **`SearchOverlay.tsx`** — per-tab inline search filtering graph nodes.

Layout is the deterministic radial tree from `src/lib/graph-layout.ts`.

### 6.3 Character Codex

The character system is a **two-page model**: a collectible-card **front** and
a dossier-style **details back**, connected by a 3D flip animation.

**List level:**
- **`src/features/characters/CharacterCodex.tsx`** — the tab's root; toolbar, list/detail orchestration.
- **`CharacterList.tsx`** — thumbnail card list with drag-reorder (see the
  WebKitGTK drag gotcha, §13), sort modes, multi-select, and tag filtering.
- **`CharacterRecycleBin.tsx`** — recycle bin scoped to the Characters tab,
  reachable from the list toolbar. Both this and the Lore bin show per-item
  **purge countdown chips** (amber → red under 3h → "purges on next launch")
  and a **Restore all** button; shared time helpers live in
  `src/lib/recycleTime.ts`, whose 24h constant must stay in sync with the
  cleanup in `db.rs`.
- **`src/components/characters/CharacterCreateDialog.tsx`** — creation dialog.

**Card front:**
- **`src/features/characters/CharacterCard.tsx`** — the card itself:
  preview-style image-left layout.
- **`src/components/characters/CardGrid.tsx`** — a **fixed 3-column × 7-row
  placement grid**. Users drag blocks from a palette
  (**`CardBlockDock.tsx`**) onto the grid, then resize/reposition them.
  Non-multi block presets are enforced once-per-card on both client and server.
- **`CardBlock.tsx`**, **`CardHeader.tsx`**, **`CardImage.tsx`** — block & chrome primitives.
- **`CardInCharacterIntro.tsx`** — edits the `in_character_intro` field (a
  first-person intro line; also displayed by the peek panel).
- **`RibbonColorPicker.tsx`** — the card's accent ribbon color.
- **`BriefDetailsEditor.tsx`** — quick-edit for short card fields.

**The flip & cinematic:**
- **`src/features/characters/CharacterFlipContainer.tsx`** — the 3D flip
  animation between front and back (`cardFlipped` in Zustand).
- **`CharacterCinematic.tsx`** — a cinematic full-art preview mode with a
  Preview/Lock toggle (persisted via the `cinematic_preview_locked` column,
  migration 005).

**Details back:**
- **`src/features/characters/CharacterDetails.tsx`** — the dossier: a fixed
  **Overview** section plus user-created tabbed sections.
- **`src/components/characters/DetailTabBar.tsx`** — tab bar with drag-reorder
  (a reference implementation of the WebKitGTK drag pattern).
- **`src/components/characters/sections/`** — one component per layout:
  `OverviewSection.tsx` (fixed), `ProseSection.tsx` (TipTap rich text),
  `CardsSection.tsx`, `TimelineSection.tsx`, `KeyValueSection.tsx`.
- **`sections/useEntryReorder.ts`** — shared hook for drag-reordering entries
  *inside* Cards/Timeline/KV sections; writes back through the ordinary
  `update_detail_section` command (no dedicated reorder endpoint).
- **`SectionCreateDialog.tsx`** — create a new section, pick its layout.
- **`ConvertSectionDialog.tsx`** + **`src/lib/section-conversion.ts`** — convert
  a section's layout after creation. Lossy conversions show a copyable
  plaintext dump of what would be lost.
- **`LinkedRecords.tsx`** — accordion of linked entities on the details back
  (accordions default collapsed).

### 6.4 Lore Archive

Two modes, toggled by `loreMode` in Zustand: **Write** and **Read**.

**Write mode:**
- **`src/features/lore/LoreArchive.tsx`** — the tab root: folder tree on the
  left, document editor on the right.
- **`src/components/lore/FolderTree.tsx`** — nested folder tree with
  drag-reorder, rename, delete (docs move to root on folder delete), and
  **its own scoped search** (the global search bar does NOT cover Lore).
  Each doc row shows a **status dot** (stub red / draft grey / wip amber /
  done green — set via right-click "Mark as…"); a stacked progress bar +
  legend at the tree's bottom rolls up the whole archive.
- **`DocumentEditor.tsx`** — the TipTap editor surface; auto-saves on blur;
  undo/redo; mounts the shared bubble menu; applies `--lore-font-*`/`--lore-size-*` typography vars.
  The prose column is a centered 860px measure; the linked-records pane
  narrows at ≤1180px and yields at ≤1000px window width.
  **Focus mode (Proposal 02, v2):** a toolbar toggle (or Ctrl+Shift+F; Esc
  exits) goes fully immersive — hides the archive header + tree + links
  panes, fades the TopDock (`body.lore-focus-immersive`) and the editor
  toolbar/footer until hovered, and centers a 720px reading column under a
  static CSS vignette. State lives locally in `LoreArchive`.
- **`DocumentDialog.tsx`** / **`FolderDialog.tsx`** — create/rename dialogs.
- **`DocumentTypographyPanel.tsx`** — the per-document font-preset bar above
  the editor (Body family + size, "More…" full dialog, "Use world defaults").
  Overrides persist to `lore_documents.typography_overrides_json` and apply as
  scoped CSS vars on a wrapping `.doc-editor__doc` div.
- **`LinkedRecordsPanel.tsx`** — linked entities for the open document.
- **`NextPagePicker.tsx`** — sets a document's Read-Mode "Next page" target
  (the `next_page_links` table) — can point at any doc world-wide.
- **`src/features/lore/LoreRecycleBin.tsx`** — Lore-scoped recycle bin (docs + folders).

**Read Mode** — the showpiece. A book-styled reading experience:
- **`src/features/lore/read/ReadModeShell.tsx`** — a **path-based sub-router**:
  LibraryShelf (folders as books on shelves) → SubLibraryView → expanded-stack /
  loose-stack (documents as stacked papers) → BookReader.
- **`LibraryShelf.tsx`**, **`SubLibraryView.tsx`** — the navigation levels.
- **`BookReader.tsx`** — the reader. Two layouts:
  - **Continuous** — one tall paper that grows with content.
  - **Paginated** — CSS-columns trickery (**`src/components/lore/read/PaginatedBody.tsx`**):
    column-width = viewport width, content reflows into N columns, the container
    translates left by `currentPage * columnWidth`. Sub-page count =
    `scrollWidth / columnWidth`; a ResizeObserver re-measures on viewport change.
    The title block renders only on sub-page 0 (like a real book's continuation pages).
- **`src/components/lore/read/`** — `BookCover.tsx`, `BookPage.tsx`,
  `BookTableOfContents.tsx`, `BookReferencesRail.tsx`, `PageTile.tsx`,
  `StackTile.tsx`, `LayoutToggle.tsx`, `ModeToggle.tsx`, `bookOrder.ts`
  (document ordering within a book).
- **Cross-doc navigation:** hitting Prev/Next at a mid-book document boundary
  opens a **confirm popup** (never an auto-jump). `next_page_links` overrides
  where "Next" goes. Next past the book's **final** document opens the
  **end-of-book colophon page** (`src/components/lore/read/BookColophon.tsx`,
  2026-06-10): "Here ends…", a continue card honoring the last doc's
  `next_page_links` entry (click navigates without a second popup — the
  colophon is itself the confirmation gate), an in-place "choose another
  volume" picker that sets that link, and return-to-library.
- **Read state + bookmarks (Proposal 03, 2026-06-11):** opening a doc upserts
  `read_progress.read_at` (`mark_document_read`); the TOC shows per-doc dots
  (amber = reading now, dim green = read, faint = unread) and the paper has a
  clickable bookmark ribbon top-left (`toggle_document_bookmark`). Deliberately
  NO progress bar or page chip on the paper — the footer already counts pages,
  and screen chrome breaks the book illusion.
- All Read Mode styling is scoped under `.lore-read-mode` in
  **`src/features/lore/read/ReadMode.css`** using paper tokens
  (`--paper-bg`, `--paper-ink`, `--paper-rule`, `--paper-deckle`,
  `--paper-edge-shadow`), themed for both dark and light. The serif stack is
  **system fonts only** — no webfont fetch (offline-first).
- See §13 for the Read Mode invariants you must not break.

### 6.5 Atlas Canvas — DETACHED

**As of 2026-06-06 the entire Atlas system is removed.** It had shipped twice
(V1: 2D ocean canvas with freehand painting + map entities; Packet 9: 3D
terrain via Three.js/React Three Fiber with splat painting), was then rebuilt
data-first, and then **the whole system was detached the same day** for a
ground-up redesign:

- World migration `011_detach_atlas.sql` drops all atlas tables.
- Migration v12 (Rust pass) rewrites stale inline `[[links]]` to map entities
  into plain text across all stored rich text.
- Three.js / @react-three dependencies were removed from the app.
- The Atlas tab and the Overview's Atlas sub-tab now render
  **`src/features/atlas/AtlasUnderConstruction.tsx`** — the ONLY file in
  `features/atlas/`: a "Still being written" quill-on-parchment animation.
  It is **pure CSS animation, deliberately** — do not convert it to
  requestAnimationFrame (WebKitGTK can stall rAF entirely on non-composited pages).

**The only surviving Atlas artifacts — required reading before any rebuild:**
- `references/atlas-2d-foundation.md` — the adopted architecture blueprint
  (data-first arrays + marching squares, 3-tier layers, referenced assets,
  centralized coordinate math).
- `prototypes/2D-AtlasMap-Prototype.html` — the validated rendering prototype.

---

## 7. Cross-System Infrastructure

### 7.1 Entity linking

- **Model:** a single `entity_links` row represents a **bidirectional** link.
  Backend queries with `(source_id = A OR target_id = A)` — no duplicate rows.
- **Explicit links:** created via **`src/components/linking/LinkPickerDialog.tsx`**
  (shows an "already linked" badge; link-type dropdown + freeform type entry).
  Displayed in the LinkedRecords panels on both Character Details and Lore documents.
- **Inline links:** typed via `[[` inside any TipTap editor
  (**`src/components/editor/InlineLinkExtension.ts`** provides trigger detection;
  the dropdown itself is the shared
  **`src/components/editor/InlineLinkAutocomplete.tsx`** — results grouped by
  system with accent dots, plus **create-in-place rows** that make a stub lore
  doc (root folder) or character from the typed query and insert the link
  without leaving the sentence).
  Stored inside TipTap JSON as spans carrying `data-inline-link`,
  `data-entity-type`, `data-entity-id` attributes. Rendered as **colored text in
  the target system's accent color, no underline**.
- **Broken links:** when a link target is deleted, the span gets strikethrough +
  a darker entity-type color. This is driven by
  **`src/components/linking/useBrokenLinkResolver.ts`** — a DOM-wide
  MutationObserver that scans link spans, asks the backend
  (`resolve_inline_links`) which targets still exist, and toggles
  `data-broken="1"`. **Any code that deletes or restores a record must call the
  exported `invalidateBrokenLinks()`** — in practice this happens automatically
  because `src/lib/commands.ts` wraps those commands with `withLinkInvalidation()`.
- **Broken-link repair (2026-06-10):** clicking a broken span opens
  **`src/components/linking/BrokenLinkRepairMenu.tsx`** (mounted once in
  WorldShell, triggered via a `wormhole:broken-link-click` CustomEvent from
  `useInlineLinkClicks`). It shows the target's recycle-bin countdown and
  offers **Restore** (always), plus **Re-point** and **Flatten to text** when
  the span lives in an editable TipTap surface —
  **`src/components/linking/editorRegistry.ts`** maps a DOM node back to its
  live editor instance; node edits go through `posAtDOM` + `setNodeMarkup` /
  `replaceWith` transactions so undo and auto-save behave normally.
- **Clicking an inline link** (`useInlineLinkClicks.ts`) opens the peek panel —
  in both view and edit mode (the spec's separate edit-mode link-editing UI was
  dropped intentionally).
- **Hover glossary cards (Proposal 04):**
  **`src/components/linking/InlineLinkHoverCard.tsx`** (mounted in WorldShell)
  shows a floating preview after a 350ms hover on any inline link in a
  **read-only** surface — character portrait/role/intro or doc title/excerpt
  (`src/lib/tiptapText.ts` extracts plain text from TipTap JSON). Suppressed
  inside editable editors (via `editorRegistry`) and on broken links; the card
  is pointer-transparent so clicks still navigate. Session-cached per world.
- **Link lifecycle:** soft-deleting an entity co-deletes its links in the same
  transaction; restore brings them back.

### 7.2 Peek panel

**`src/components/common/PeekPanel.tsx`** — a panel that slides in from the
right at 40% width and previews any entity (character, lore doc) without
leaving the current context. Rules: one panel at a time, explicit close, and an
"Open Full" action that does a full-screen slide transition with a back button.
Driven by `peekTarget` in Zustand.

### 7.3 Search

- **Global search** (**`src/components/common/GlobalSearchBar.tsx`**, lives in
  the TopDock) is **scoped to the Overview tab only** — deliberate design.
- **Lore** has its own scoped search inside `FolderTree.tsx`.
- **Overview graphs** have per-tab node filtering via `SearchOverlay.tsx`.
- Backend: `search::search_world`.

### 7.4 Shared rich-text editor

**`src/components/editor/TipTapEditor.tsx`** — the shared editor used by
character prose sections and lore documents. Companions:
- **`EditorBubbleMenu.tsx`** — selection toolbar: grouped font picker, size,
  B/I/U/S, an 11-swatch codex color palette (stored as theme-adaptive
  `var(--codex-color-*)` references, so colors adapt to dark/light), text
  alignment (left/center/right/justify), and reset.
- **`TextStyleWithFontSize.ts`** — TextStyle extension extended with
  `fontSize` and `color` attributes.
- Underline/Strike come from StarterKit (v3.22 bundles them — adding
  `@tiptap/extension-underline` separately would duplicate the extension).

### 7.5 Shared UI primitives (`src/components/common/`)

`ConfirmDialog.tsx`, `ContextMenu.tsx`, `Lightbox.tsx` (image viewer),
`TopDock.tsx` (system tabs + global search), `PeekPanel.tsx`.

### 7.6 Asset pipeline

Images are stored **inside the world DB as BLOBs** (`assets` table). Retrieval:
`get_asset_bytes` returns raw binary over IPC (`tauri::ipc::Response`, zero
base64 overhead) → `src/hooks/useImageCache.ts` converts to a Blob URL and
caches it in a module-scope singleton. Graph views bulk-fetch via `get_asset_batch`.

---

## 8. Typography System

Built across two iterations (v1 = Characters only; Packet 10 = full system).

- **Chrome voice (2026-06-11, "Option E"):** the app chrome speaks ONE font —
  **iA Writer Quattro**. The three voice tokens in `src/styles/typography.css`
  (`--font-display`, `--font-voice-body`, `--font-micro` — kept separate so
  chrome stays re-skinnable) and the `global.css` body font all resolve to it.
  Chrome hierarchy = weight/size/case/tracking, never typeface changes.
  Quattro's four woff2 faces are **vendored manually** from
  github.com/iaolo/iA-Fonts (it's not on Google Fonts, so `sync-fonts.py`
  doesn't manage it).
- **`src/lib/font-catalog.ts`** — the **single source of truth** for fonts.
  11 bundled OFL families (Cormorant Garamond, Crimson Pro, EB Garamond,
  Cinzel, Cormorant Unicase, UnifrakturMaguntia, Caveat, Special Elite, Inter,
  iA Writer Quattro, JetBrains Mono) + 2 system stacks, grouped Serif /
  Display / Decorative / Sans / Mono / System, plus a `matchFamilyKey` helper.
  Google-Fonts families are synced by `scripts/sync-fonts.py` into
  `src/assets/fonts/fonts.css`.
- **`src/lib/typography-core.ts`** — `makeTypography()` factory: given a
  system's config it produces the CSS-var applier, Tauri-Store persistence with
  debounced save, and the React hook. Both `useCharacterTypography` and
  `useLoreTypography` are instantiations of it. (An `inheritCascade` mechanism
  built for the Atlas popover survives in the core even though Atlas is gone.)
- **Per-world popovers:** `src/features/characters/CharacterTypographySettings.tsx`
  and `src/features/lore/LoreTypographySettings.tsx` (gear icons in each
  system's toolbar) configure Body / Headings / Quotes / Labels roles. Both
  render the shared **`src/components/typography/TypographyDialog.tsx`**
  (live preview + role rows + reset), tinted with the per-system accent.
- **Per-document overrides (Lore only):** migration 009 +
  `update_document_typography` + `DocumentTypographyPanel.tsx`.
- **Scope boundary:** typography vars apply to **write mode only**. Read Mode
  is intentionally excluded — it keeps its own `--paper-*` token system.
- Design intent (from the project owner): typography is an *emotional
  expressivity* feature — preserve the catalog breadth and the multi-layer
  model (world-level roles → per-document overrides → inline marks).

---

## 9. Theming & Visual Identity

- **Dark (default) / Light** theme toggle; implemented entirely with CSS custom
  properties (`src/styles/themes.css`); persisted via the Tauri Store plugin.
- **2026-06-10 polish:** the card foil shine, the Overview ambient glow, and
  the graph node halo/pulse effects were removed (the halos used per-frame SVG
  blur — the main cause of laggy pan on WebKitGTK). Don't reintroduce
  continuous SVG filter animations on graph nodes.
- **System accent colors** — used consistently for tabs, link colors, graph
  nodes, dialog accents:

| System | Color |
|---|---|
| Overview | green `#4ade80` |
| Atlas | blue `#4a9eff` (tab/placeholder only while detached) |
| Characters | purple `#a78bfa` |
| Lore | amber `#f5a623` |

- Inline link spans are colored by their **target's** system color.

---

## 10. Implementation Status — What's Built

The authoritative status document is **`Initial-Specs/IMPLEMENTED.md`** (the
original spec packets are archived in `Initial-Specs/_archive/`). Summary:

| Packet | Subject | Status |
|---|---|---|
| 1 | Master Product Spec | ✅ Shipped as specced |
| 2 | Core build (stack, DBs, migrations, soft-delete, assets, links, theme) | ✅ Shipped |
| 3 | Atlas Canvas V1 | ❌ Shipped, then **removed** (2026-06-06) |
| 4 | Character Codex | ✅ Shipped |
| 5 | Lore Archive (incl. Read Mode) | ✅ Shipped |
| 6 | Linking, Search, Shared Relations | ✅ Shipped |
| 7 | UX & Interaction | ✅ Shipped (Overview design diverged — see below) |
| 8 | QA / Acceptance | ✅ Applied; remains the regression reference |
| 9 | Atlas v2 (3D terrain) | ❌ Shipped, then **removed** with Atlas |
| 10 | Typography v2 | ✅ Shipped |

**Important divergences from the original specs** (current code is canon):

1. **World Overview** — spec described a root-node force graph + dashboard
   toggle. Shipped instead: the **three-tab deterministic graph system**.
   Ignore spec §5 acceptance criteria in Packet 8.
2. **`card_layout_variant` column is dead** — exists in the DB (migration 001),
   referenced by old spec/QA text ("landscape and portrait layouts"), but **no
   frontend code reads it**. Only the preview-style (image-left) card layout exists.
3. **`in_character_intro` is live**, not "reserved for future use" as the spec
   said — `CardInCharacterIntro.tsx` edits it and `PeekPanel.tsx` displays it.
4. **No separate `features/links|assets|search/` folders** — the shipped
   structure is flatter (see §5.1).
5. **Inline-link edit-mode behavior** — clicking opens the peek panel in edit
   mode too; there's no separate "edit target" UI.
6. **Underline/Strike** ship via StarterKit, not a standalone extension.

---

## 11. What Needs Fixing / Known Issues

From **`Logs To Fix.md`** (the running issue log) plus known debt:

### Critical / queued

1. **Read Mode paper aesthetics need a dedicated pass.** The current `.book-page`
   surface isn't where it should be: typography balance, drop-cap proportion,
   margin rhythm, and the paper's contrast against the stage all need
   refinement. (`src/features/lore/read/ReadMode.css`, `BookPage.tsx`)
2. **Layout-toggle icons unclear.** The glyphs on `.book-page__layout-toggle`
   (upper-right of the paper, switches paginated ↔ continuous) don't read as
   "page view" vs "infinite scroll". Redesign both icons during the paper pass.
   (`src/components/lore/read/LayoutToggle.tsx`)

### Recently resolved (2026-06-10)

3. ~~Customizable end-of-book "next document" target~~ — **shipped** as the
   colophon page (see §6.4).
4. Plus a polish pass: Overview pan lag (blurred animated node halos removed),
   the ambient multi-sun glow behind the graph removed, shared-node
   square-in-circle rendering fixed, card foil shine removed everywhere,
   character-open entrance transition added, and the card↔details crossfade
   smoothed (scale mismatch + void-pulse + tab-row layout jump removed).
   Details in `Logs To Fix.md`.

### Technical debt

5. **Dead DB column** — `characters.card_layout_variant` (see §10). Harmless,
   but a future migration could drop it (precedent: migration 006 dropped other
   dead columns).
6. **Orphaned `inheritCascade` machinery** in `src/lib/typography-core.ts` —
   built for the removed Atlas popover. Keep (a rebuilt Atlas will likely want
   it) but know it currently has no consumer.
7. **Outdated QA checklist items** in Packet 8 (`_archive/08_QA_...`): §5 (old
   Overview model) and the §7 landscape/portrait check — both reference designs
   that no longer exist. Don't test them; write fresh criteria when needed.
8. ~~Typography direction open question~~ — **decided 2026-06-11: Option E.**
   The chrome speaks one voice (iA Writer Quattro); the three voice tokens in
   `typography.css` all resolve to it and the body font follows. Codex/Lore
   user typography and Read Mode untouched. (The option-comparison folio was
   deleted in the 2026-06-12 prototype cleanup; runner-up families — Literata,
   Atkinson Hyperlegible, Lexend, IBM Plex — remain candidates for the user
   content catalog.)

### The elephant: Atlas

9. **The Atlas system doesn't exist.** It's the single biggest open work item —
   a full ground-up rebuild following `references/atlas-2d-foundation.md` and
   the validated `prototypes/2D-AtlasMap-Prototype.html`. Until then both the
   Atlas tab and Overview's Atlas sub-tab show the placeholder.

---

## 12. Planned / Future Features

From **`Future-Feature-Plans.md`** (pre-spec ideas notebook):

1. **Atlas Canvas rebuild (2D first)** — next in the priority queue.
   Architecture already chosen: data-first arrays + marching squares rendering,
   3-tier layers, referenced (not embedded) assets, centralized coordinate math.
2. **3D Atlas Canvas** — Three.js/R3F, with a continuous zoom-driven 2D→3D
   transition (Google-Maps-style: camera pitch + terrain displacement + entity
   LOD all interpolated from one `transitionFactor`). A version of this shipped
   in Packet 9 and was removed with the detachment; it will return after the 2D
   rebuild settles.
3. **Cyber-Goggles (AI Lore Companion)** — deliberately built **last**. An AI
   roleplay system for stress-testing narrative decisions: the user plays one
   side of a lore conflict, the AI plays the other, drawing on the world's
   characters/lore/links via structured retrieval from the world SQLite file.
   Sessions are stored in separate `roleplay_sessions` / `roleplay_messages`
   tables; **nothing auto-merges into canon** — the user explicitly accepts
   outcomes back into lore. Technical direction: Claude API with prompt caching
   and tool use, all calls through the Tauri backend (the only feature that
   requires network access).

Priority queue: Atlas 2D → Linking polish → Search & polish → 3D Atlas → Cyber-Goggles.

---

## 13. Critical Conventions & Gotchas

Things that WILL break the app (or have broken it before) if you don't know them:

### WebKitGTK HTML5 drag-and-drop
Tauri's Linux webview **silently drops the `drop` event** if a drag carries no
`dataTransfer` payload. Every `onDragStart` must call
`e.dataTransfer.setData('text/plain', …)` and set `effectAllowed = 'move'`;
every `onDragOver` must set `dropEffect = 'move'`. Reference implementations:
`src/components/characters/DetailTabBar.tsx`,
`src/components/characters/sections/useEntryReorder.ts`,
`src/features/characters/CharacterList.tsx` (`handleDragStart`).
**Symptom if missed:** the card appears to drag but snaps back on release with no error.

### Read Mode invariants
1. **Paper height floor** — `--paper-min-h` is captured **once at module load**
   from `window.screen.availHeight` (clamped 700–1400, minus ~120 for chrome),
   set on `:root`, and never shrinks within a session. Paper size comes from
   the *display*, not the window — shrinking the window scrolls the stage
   rather than resizing the paper.
2. **`.book-reader__stage` must use `align-items: flex-start`** (never
   `stretch`). Continuous mode relies on `.book-page` growing past its
   `min-height`; `stretch` pins the paper to the stage height and bleeds body
   content past the paper background.
3. **Header repagination is accepted** — in paginated mode the title block only
   renders on sub-page 0, so total page count may shift as the user navigates.
   That's by design.
4. **Cross-doc nav always confirms** — never auto-jump across documents.
5. **Body rhythm** — first-line indent on `p + p`, zero inter-paragraph margin;
   drop cap only on the first paragraph's first letter.

### Other rules
- **Pure CSS for the Atlas placeholder** — WebKitGTK can stall rAF on
  non-composited pages; don't "optimize" `AtlasUnderConstruction` to rAF.
- **Call `invalidateBrokenLinks()`** after any record delete/restore (or, better,
  route through the already-wrapped commands in `src/lib/commands.ts`).
- **All CRUD through Tauri commands.** Never persist content frontend-side.
- **One world open at a time.** Don't design features assuming multiple open worlds.
- **Offline-first.** No webfont fetches, no CDN assets, no network calls
  (Cyber-Goggles will be the sole, explicit exception).
- **Tab state in Zustand, not the URL.**
- **Git:** primary branch is `master` (not `main`); no Co-Authored-By lines in commits.

---

## 14. Repository Map

```
Wormhole/
├── CLAUDE.md                  # AI-agent project instructions (architecture digest)
├── CODEBASE_OVERVIEW.md       # ← this document
├── Logs To Fix.md             # running issue log (severity-tagged)
├── Future-Feature-Plans.md    # pre-spec ideas (3D Atlas, Cyber-Goggles, queue)
├── Initial-Specs/
│   ├── IMPLEMENTED.md         # ★ consolidated build status + spec deltas — start here
│   ├── 00_README_Index.md
│   └── _archive/              # the original spec packets (01–10)
├── references/
│   ├── atlas-2d-foundation.md # ★ Atlas rebuild blueprint (protected)
│   └── Wormhole_Vision.pdf / Wormhole_DetailedVision.pdf
├── prototypes/                # implemented prototypes are deleted once shipped (2026-06-12 cleanup)
│   ├── 2D-AtlasMap-Prototype.html         # ★ validated Atlas rendering prototype (protected)
│   └── atlas-workspace-redesign.html      # Atlas workspace redesign reference (+ NOTES.md)
├── src/                       # React frontend (see §5)
│   ├── app/                   # App, providers, routes
│   ├── assets/fonts/          # bundled OFL fonts (~1.5 MB)
│   ├── components/            # reusable blocks: characters/, common/, editor/,
│   │                          #   linking/, lore/(+read/), typography/, worlds/graph/
│   ├── features/              # screens: atlas/, characters/, lore/(+read/), worlds/
│   ├── hooks/                 # useImageCache, useGraphDrag, use*Typography
│   ├── lib/                   # commands, graph-layout, section-conversion,
│   │                          #   font-catalog, typography-core, settings-store
│   ├── state/store.ts         # the Zustand store
│   └── styles/                # global.css, themes.css, typography.css
└── src-tauri/                 # Rust backend (see §4)
    └── src/
        ├── lib.rs             # Tauri builder + command registration (~70 commands)
        ├── db.rs              # AppDatabase (registry + active world)
        ├── migrations.rs      # two-track migration runner (registry v2, world v12)
        ├── migrations/        # registry/*.sql, world/*.sql
        └── commands/          # worlds, assets, characters, character_blocks,
                               #   character_sections, lore, links, search, graph
```

★ = protected / required-reading artifacts.

---

## 15. Running the App

```bash
npm run tauri dev                                   # start dev (frontend + Rust)
cargo check --manifest-path src-tauri/Cargo.toml    # type-check the Rust side
```

Platform: developed on Linux (WebKitGTK webview — hence the drag-and-drop and
rAF gotchas in §13).

---

*If you are an AI agent starting work on this codebase: read `CLAUDE.md` first
(operational rules), then `Initial-Specs/IMPLEMENTED.md` (status + spec deltas),
and treat the divergences listed in §10 of this document as canon over the
archived spec text.*
