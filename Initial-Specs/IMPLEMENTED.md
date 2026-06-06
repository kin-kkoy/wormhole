# Implemented Specs — Summary

This file summarizes the build status of every original spec packet. The full originals live in `_archive/`; this file is the single reading entry point.

> **⚠ Atlas Canvas DETACHED (2026-06-06):** the entire Atlas system (2D map,
> 3D terrain, map entities, SQLite schema, specs, prototypes) was removed for
> a ground-up redesign (world migration 011). The Atlas tab remains as an
> "In Development" placeholder. The only surviving Atlas references are
> `references/atlas-2d-foundation.md` (architecture blueprint) and
> `prototypes/2D-AtlasMap-Prototype.html` (validated rendering prototype).

---

## Packet 1 — Master Product Spec (`01_Master_Product_Spec.md`) — SHIPPED

- **What it was:** Product identity and scope anchor — defines what Wormhole is (a local-first single-user worldbuilding app across three systems: Atlas Canvas, Character Codex, Lore Archive) and what it explicitly is not.
- **What shipped:**
  - Three-system product shape built as specced (`src/features/characters/`, `src/features/lore/`; the Atlas slot is currently an in-development placeholder)
  - Single-user, local-first, no auth/cloud/collab
  - V1 boundaries honored: no custom page-builder, no game-engine features, no Obsidian-clone scope
  - Freeform tags, per-world recycle bin, dark/light theme, cross-system linking — all per spec
  - Product language ("World," "Atlas Canvas," "Character Codex," "Lore Archive") used consistently throughout

---

## Packet 2 — Core Build Packet (`02_Core_Build_Packet.md`) — SHIPPED

- **What it was:** Stack, architecture, two-database model, migrations, project structure, soft-delete, asset BLOB pipeline, inline links, undo/redo, theme system, search baseline.
- **What shipped:**
  - Tauri 2 + React 19 + TypeScript + Vite + Rust + SQLite + TipTap + D3 (`package.json`, `Cargo.toml`)
  - Two-database system: `registry.db` (paths + metadata cache) + `.wormhole` per-world files (`src-tauri/src/db.rs`)
  - Version-tracked migrations, registry and world schemas separate (`src-tauri/src/migrations/registry/`, `src-tauri/src/migrations/world/`)
  - One Tauri command file per domain: `commands/{worlds,characters,character_blocks,character_sections,lore,links,assets,search,graph}.rs`
  - Soft-delete with `deleted_at` on characters, lore_documents, lore_folders, entity_links; 24h recycle bin cleanup on startup
  - Asset BLOB pipeline: `assets::get_asset_bytes` via `tauri::ipc::Response` (no base64); client-side Blob URLs via `hooks/useImageCache.ts`
  - `[[`-trigger TipTap inline link extension (`src/components/editor/InlineLinkExtension.ts`, `EditorBubbleMenu.tsx`)
  - Routes: `/` → WorldIndex, `/world/:worldId` → WorldShell; tab state in Zustand (`src/state/store.ts`)
  - Dark/light theme, persisted via Tauri Store plugin (`src/lib/settings-store.ts`, `src/styles/themes.css`)
  - Tag system with genre-based suggestions on world creation
- **Diverged from spec:**
  - Spec listed `features/links/`, `features/assets/`, `features/search/` as separate feature folders — none of these exist. Linking lives in `components/linking/`, assets are handled entirely through `lib/commands.ts` + backend, search is in `components/common/GlobalSearchBar.tsx`. The shipped structure is flatter and cleaner.
  - Spec says clicking an inline `[[link]]` in **edit mode** "selects the link node for editing (change target or delete)." In practice, clicking in edit mode opens the peek panel — same behavior as view mode. There is no separate edit-target UI for inline links.

---

## Packet 3 — Atlas Canvas Build Packet — REMOVED

- Shipped as V1 (ocean canvas, freehand painting, map entities, zoom/pan),
  was rebuilt data-first (2026-06-06), then the whole Atlas system was
  **detached the same day** for a ground-up redesign. Code, schema, spec, and
  prototypes removed; see the banner at the top of this file.

---

## Packet 4 — Character Codex Build Packet (`04_Character_Codex_Build_Packet.md`) — SHIPPED

- **What it was:** Two-page character model (Card front + Details back), fixed 3×7 inventory grid, tabbed detail sections (prose/cards/timeline/key-value), 3D flip animation, cinematic preview, recycle bin, typography v1.
- **What shipped:**
  - Character list with thumbnail cards, drag-reorder, sort modes, multi-select, tag filter (`src/features/characters/CharacterList.tsx`, `CharacterCodex.tsx`)
  - Card front: preview-style image-left layout, fixed 3×7 CSS grid, drag-from-palette block placement, resize, reposition; non-multi preset enforcement both client and server (`src/features/characters/CharacterCard.tsx`, `src/components/characters/CardGrid.tsx`, `CardBlockDock.tsx`)
  - 3D flip animation between card and details (`src/features/characters/CharacterFlipContainer.tsx`)
  - Cinematic preview with Preview/Lock toggle (`src/features/characters/CharacterCinematic.tsx`; `cinematic_preview_locked` column via migration `005`)
  - Detail sections: Overview (fixed), user-customizable sections with prose/cards/timeline/key-value layouts (`src/features/characters/CharacterDetails.tsx`, `src/components/characters/sections/`)
  - Section layout conversion with copyable plaintext dump for lossy conversions (`src/components/characters/ConvertSectionDialog.tsx`, `src/lib/section-conversion.ts`)
  - In-section entry reorder via shared `useEntryReorder.ts` hook
  - LinkedRecords accordion on Details (`src/components/characters/LinkedRecords.tsx`)
  - Characters-tab recycle bin (`src/features/characters/CharacterRecycleBin.tsx`)
  - Typography v1: CSS-var system, bundled fonts (Cormorant Garamond, Crimson Pro, Inter), per-world settings popover (`src/features/characters/CharacterTypographySettings.tsx`, `src/hooks/useCharacterTypography.ts`)
  - Inline font+size picker in TipTap bubble menu (`src/components/editor/EditorBubbleMenu.tsx`, `TextStyleWithFontSize.ts`)
- **Diverged from spec:**
  - `card_layout_variant TEXT NOT NULL DEFAULT 'landscape'` exists in the DB schema (migration 001) and the original spec + QA packet referenced landscape/portrait layout variants — but **no frontend code reads or uses this column**. It is a dead field. The shipped card uses only the preview-style (image-left) layout for all characters. Ignore any QA check referencing "landscape and portrait header layouts."
  - `in_character_intro` field: the spec says it is "stored and reserved for future card-front use, not rendered in V1." In reality it is rendered — `CardInCharacterIntro.tsx` edits it, and `PeekPanel.tsx` displays it when present. The field is live, not reserved.
- **Open follow-ups:** Packet 10 (Typography v2) added lore parity and the expanded inline toolbar.

---

## Packet 5 — Lore Archive Build Packet (`05_Lore_Archive_Build_Packet.md`) — SHIPPED

- **What it was:** Folder tree, document CRUD, TipTap WYSIWYG editor (JSON storage), linked records panel, inline `[[links]]`, Read Mode (paginated + continuous paper-styled book reader, cross-doc next-page navigation).
- **What shipped:**
  - Folder tree with nesting, drag-reorder, rename, delete (documents-to-root on folder delete) (`src/components/lore/FolderTree.tsx`, `FolderDialog.tsx`, `src-tauri/src/commands/lore.rs`)
  - Document CRUD, TipTap editor with auto-save on blur, undo/redo (`src/components/lore/DocumentEditor.tsx`, `DocumentDialog.tsx`)
  - Linked records panel on each document (`src/components/lore/LinkedRecordsPanel.tsx`)
  - Lore-scoped search inside FolderTree
  - Lore recycle bin (`src/features/lore/LoreRecycleBin.tsx`)
  - Read Mode shell with path-based sub-router: LibraryShelf → SubLibraryView → expanded/loose stack → BookReader (`src/features/lore/read/ReadModeShell.tsx`, `LibraryShelf.tsx`, `SubLibraryView.tsx`)
  - BookReader: continuous and paginated (CSS-columns) layouts, paper-styled tokens (`--paper-*`), serif-only system stack, screen-height floor invariant (`src/features/lore/read/BookReader.tsx`, `BookPage.tsx`, `PaginatedBody.tsx`, `src/features/lore/read/ReadMode.css`)
  - Cross-doc next-page links via `next_page_links` table and `NextPagePicker.tsx`
  - BookCover, TableOfContents, ReferencesRail, LayoutToggle, ModeToggle (`src/components/lore/read/`)
- **Open follow-ups:** Packet 10 (Typography v2) will add per-world lore typography popover and per-document font overrides.

---

## Packet 6 — Linking, Search, and Shared Relations Packet (`06_Linking_Search_Shared_Relations_Packet.md`) — SHIPPED

- **What it was:** Shared `entity_links` model, bidirectional display, link type labels, inline `[[`-trigger autocomplete, broken-link resolver, peek panel, global search scoped per context.
- **What shipped:**
  - Single-row bidirectional `entity_links` table; backend queries `(source_id=A OR target_id=A)`
  - LinkPickerDialog with "already linked" badge, link-type dropdown + freeform entry (`src/components/linking/LinkPickerDialog.tsx`)
  - `[[`-trigger autocomplete (`InlineLinkExtension.ts`) with entity-type colored spans, `data-inline-link` / `data-entity-type` / `data-entity-id` attrs
  - Broken-link resolver: DOM-wide MutationObserver toggling `data-broken="1"` (`src/components/linking/useBrokenLinkResolver.ts`); `invalidateBrokenLinks()` called from delete/restore commands via `withLinkInvalidation()` in `src/lib/commands.ts`
  - Inline link click handler (`useInlineLinkClicks.ts`) opening peek panel
  - Global search bar scoped to Overview; lore has own scoped search (`src/components/common/GlobalSearchBar.tsx`)
  - Soft-delete with link co-deletion in same transaction; restore restores links
  - Linked records panels on Character Details and Lore document
  - Graph commands for shared-node CRUD + auto-detect (`src-tauri/src/commands/graph.rs`)

---

## Packet 7 — UX and Interaction Packet (`07_UX_Interaction_Packet.md`) — SHIPPED

- **What it was:** Cross-system UX rules — top dock, dialog patterns, empty states, motion, system identity colors, peek panel, full-screen slide transition, dark/light theme, WebKitGTK drag-and-drop fix.
- **What shipped:**
  - Top dock with Overview/Atlas/Characters/Lore tabs (`src/components/common/TopDock.tsx`)
  - System accent colors (green/blue/purple/amber) applied via CSS throughout
  - ConfirmDialog, ContextMenu shared primitives (`src/components/common/`)
  - Peek panel sliding from right at 40% width, single-panel-at-a-time, explicit close, full-screen "Open Full" slide transition with back button (`src/components/common/PeekPanel.tsx`)
  - Lightbox for images (`src/components/common/Lightbox.tsx`)
  - World Overview is a **three-tab graph system** — Atlas / Characters / Lore tabs (`OverviewTabSelector.tsx`, `WorldOverview.tsx`); Characters and Lore render dedicated graphs (`CharactersGraph.tsx`, `LoreGraph.tsx`), the Atlas tab shows the in-development placeholder. A per-tab search bar filters nodes inline (`SearchOverlay.tsx`). Tab state persisted in Zustand (`overviewTab`).
  - HTML5 drag reorder fix for WebKitGTK: `dataTransfer.setData('text/plain', …)` + `effectAllowed = 'move'` pattern applied in `DetailTabBar.tsx`, `useEntryReorder.ts`, `CharacterList.tsx`
  - Empty states throughout each system
- **Diverged from spec (major):** The original spec described two view modes for World Overview — (A) a single force-directed graph with a root world node, group nodes for Characters/Lore/Atlas, and expandable child nodes showing recent records; (B) a "dashboard" card/grid toggle. **Neither of these shipped.** The final design — after iteration — is a three-tab graph system where each tab is a dedicated relationship graph for one system (Characters, Lore documents; formerly Atlas entities). There is no root node, no dashboard mode, no physics simulation. The deterministic radial layout (`src/lib/graph-layout.ts`) is used throughout. This is the correct, current design. Any future AI working on Overview should treat the three-tab graph model as the established pattern, not the spec's root-node or dashboard descriptions.

---

## Packet 8 — QA, Acceptance, and Release Packet (`08_QA_Acceptance_Release_Packet.md`) — SHIPPED

- **What it was:** V1 "definition of done" — acceptance criteria across all systems, regression checklist, release blockers.
- **What shipped:** Applied as acceptance benchmark across the V1 build. All major categories pass (world management, overview, character codex, lore archive, linking, search, persistence, destructive actions, UX consistency; atlas checks retired with the system). No known data-loss bugs, no orphaned links, no recycle-bin bypass. Remains the active QA reference for regression checks.
- **Outdated checklist items — do not test these:**
  - §5 World Overview: the entire acceptance section describes the old root-node + dashboard model. The correct Overview is a three-tab graph system (see Packet 7 note above). Ignore §5 entirely; write new acceptance criteria for the three-tab model when needed.
  - §7 Character Codex: "landscape and portrait header layouts work per character" — this refers to the dead `card_layout_variant` column. The shipped card uses only the preview-style layout. This check would always fail and should be ignored.

---

## Packet 9 — Atlas Canvas v2 (3D, Painting, Layers, Shaders) — REMOVED

- Shipped (Three.js/R3F heightmap + splat painting, 2D/3D toggle, shader
  scaffold), then **detached with the rest of the Atlas system (2026-06-06)**.
  Three.js / @react-three dependencies were removed from the app; see the
  banner at the top of this file.

---

## Packet 10 — Typography v2 (`10_Typography_v2_Packet.md`) — SHIPPED

- **What it was:** Lore-side (and originally atlas-side) typography popovers, per-document lore font overrides, expanded inline toolbar (color, underline, strikethrough, alignment), and an expanded font catalog (~10 OFL families from 3).
- **What shipped:**
  - **Shared font catalog** (`src/lib/font-catalog.ts`): single source of truth — 10 bundled OFL families (Cormorant Garamond, Crimson Pro, EB Garamond, Cinzel, Cormorant Unicase, UnifrakturMaguntia, Caveat, Special Elite, Inter, JetBrains Mono) + 2 system stacks, grouped into Serif / Display / Decorative / Sans / Mono / System categories, plus `matchFamilyKey`. Fonts bundled offline via `scripts/sync-fonts.py` → `src/assets/fonts/fonts.css` (~1.5 MB total).
  - **Generic typography engine** (`src/lib/typography-core.ts`): `makeTypography()` factory powering all three systems (CSS-var apply, Tauri Store persistence, debounced save, the React hook). `useCharacterTypography` refactored onto it (no behavior change).
  - **Lore typography popover** (`src/features/lore/LoreTypographySettings.tsx`, `useLoreTypography.ts`): gear in the Lore Archive toolbar; Body / Headings / Quotes / Labels roles; `--lore-font-*` / `--lore-size-*` tokens applied to `DocumentEditor` (write mode only — Read Mode keeps its `--paper-*` tokens).
  - Atlas typography popover — removed with the Atlas system (the generic `inheritCascade` machinery it used remains in `lib/typography-core.ts`).
  - **Per-document lore overrides** (migration `009_lore_doc_typography.sql`, `update_document_typography` command, `DocumentTypographyPanel.tsx`): font-preset bar above the editor (Body family + size, "More…" full-role dialog, "Use world defaults"); overrides applied as scoped CSS vars on a wrapping `.doc-editor__doc` div.
  - **Expanded inline toolbar** (`EditorBubbleMenu.tsx`): grouped font picker, size, B/I/U/S, 11-swatch codex color palette (stored as theme-adaptive `var(--codex-color-*)`), alignment (left/center/right/justify), reset. `TextStyleWithFontSize.ts` gained a `color` attribute; `@tiptap/extension-text-align` added (Underline/Strike come from StarterKit). The lore `DocumentEditor` now also mounts the shared bubble menu.
  - **Shared modal** (`src/components/typography/TypographyDialog.tsx`): one generic dialog (live preview + role rows + reset/done) reused by the Character and Lore popovers with per-system accent.
- **Diverged from spec:** the expanded toolbar uses StarterKit's bundled Underline/Strike rather than a separate `@tiptap/extension-underline` (StarterKit v3.22 includes them; adding again duplicates the extension). Character popover was migrated onto the shared `TypographyDialog` (the old `CharacterTypographySettings.css` is now unused).
