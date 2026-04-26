# Packet 4 — Character Codex Build Packet

> **Status:** Built (V1) + extended 2026-04-25 in the Codex polish pass — typography v1 (CSS-var system, bundled fonts, role-level settings popover), inline font picker (TipTap bubble menu), live drag-reflow on the character grid, animated bulk-action bar, codex-aesthetic dashboard chrome and empty state, LinkedRecords polish, CardBlock view-mode kept frameless per user preference. Pending **Packet 10** for Lore/Atlas typography parity and expanded inline toolbar.

## 1. Purpose of this packet
This packet defines the Character Codex system:
- the two-page character model (Card + Details)
- character card grid layout
- character details tabbed panels
- browsing and list view
- data model
- scope boundaries

## 2. System definition
Character Codex is the character profile and detail system.

Each character has **two pages** that form a single flippable unit:

### Character Card Page (front)
The first impression. A fixed-viewport, grid-based layout showing who the character is at a glance. Like a passport, trading card, or inventory screen.

### Character Details Page (back)
The character bible. A horizontally-navigated, tabbed panel system showing deeper material — background, relationships, affiliations, opinions, FYIs. What makes this character *them*.

The user flips between the two with a **literal 3D card flip animation** triggered by a toggle button on the card.

### What lives where
- **Card**: image (preview-style, image-forward), name, ribbon/accent, brief details, grid blocks (personality, powers, quick facts, etc.)
- **Details**: background, how relationships formed, affiliations with context, opinions on other characters, FYIs, deeper structured content — and Linked Records
- **Lore Archive** (separate system): narrative writing — scenes, chapters, diary entries, story journey

## 3. V1 scope
### Included
- character list/grid with thumbnail cards
- search by name
- manual reordering (drag-and-drop), default alphabetical
- create/edit/delete character
- character card page with inventory-style grid blocks
- character details page with horizontal tabbed panels
- 3D flip animation between card and details
- character image (preview-style: image-forward, name + title prominent)
- objective summary (on details overview)
- linked records section (on details page)
- decorative ribbon/accent
- cinematic preview view (full-bleed image alt-view of the card, togglable via Preview / lockable via Lock)
- view/edit mode toggle
- post-creation conversion between section layout types (prose ↔ cards ↔ timeline ↔ key-value) with a copyable plaintext dump of any content that will be dropped
- recycle bin (scoped to the Characters tab) showing soft-deleted characters with Restore and Delete-permanently actions; 24h auto-purge

### Excluded
- per-field font styling
- custom typography engine
- animation player systems
- built-in art tools or sprite editing

## 4. Character core schema
Use the `characters` table.

Fields:
- id
- world_id
- image_asset_id nullable
- name
- short_role nullable (plain text) — displayed in the cinematic preview view
- objective_summary nullable (rich text JSON) — displayed in the details Overview section
- in_character_intro nullable (rich text JSON) — reserved for future card-front use
- decorative_ribbon nullable
- brief_details_json nullable — JSON array of key-value pairs (e.g. `[{"key": "Title", "value": "Fleet Commander"}]`)
- tags_text nullable — comma-separated tags surfaced in the list view filter
- cinematic_preview_locked boolean (default false) — when true, the codex opens the character directly into the cinematic view
- sort_order integer nullable — for manual ordering in the character list
- created_at
- updated_at
- deleted_at nullable — for recycle bin soft-delete

## 5. Character Card Page (front)

### Purpose
The card is the "first impression." It fits on one screen without scrolling. The user sees everything at a glance.

### Layout
The card takes up **80% of the world shell width** with symmetric side margins. On screens narrower than 1024px, card scales to 90%. The remaining margin space has a transparent background.

### Layout — Preview-style (image-forward)
The card uses a single preview-style layout: the character's image anchors the left side and extends the full card height; the right side holds the header info and the inventory grid.

Card header (right column, above the grid):
- **Name** (required) — shown in a prominent colored banner row at the top of the right column.
- **Ribbon/accent** — optional decorative color stripe. User selects from a 12-color swatch picker or enters a custom hex color (#RRGGBB). Stored as a nullable hex string. Purely decorative — not used for filtering, searching, or logic. Shown only in edit mode or if the value is set.
- **Brief details** (optional) — key-value pairs (e.g., Title: Fleet Commander, Born: Year 412, Status: Active).

No in-character intro block renders on the card in V1 — the `in_character_intro` field is stored and reserved for a future card-front use, but the shipped card keeps the header tight (name + ribbon + brief details only).

Linked Records does **not** appear on the card. It lives exclusively on the Details back where it has dedicated space.

### Cinematic preview (alt card front)
Each character has a second front-of-card view — a **cinematic preview** — which shows the character image full-bleed with only the name and short_role overlaid. The toolbar offers two controls:
- **Preview** — temporarily toggles to the cinematic view while the user clicks the button.
- **Lock** — writes `cinematic_preview_locked = true`, which makes the cinematic view the default front whenever this character is opened.

The details back and grid-editing flow are unaffected by this toggle.

### Content area — Inventory grid
Below the header, the content area uses a **CSS Grid layout**.

Grid rules:
- fixed at **3 columns** and **7 rows** — this is the maximum grid capacity
- the grid does NOT scroll — it fits within the card viewport
- total grid height is calculated to fill remaining card space after the header
- blocks snap to grid cells
- a block can span **1–3 columns** and **1–2 rows**
- blocks must not overlap — the UI prevents placement in occupied cells with a visual indicator (red highlight on unavailable cells)
- if a block's col_span would exceed remaining columns in a row, the drag is rejected
- grid cells may be left intentionally empty for visual breathing room
- in view mode, rows size to `auto` so sparsely populated cards don't stretch blocks; in edit mode rows are equal (`1fr`) so drop targets stay on a predictable cell grid
- block content that exceeds the block's visible height scrolls internally within the block

### Block presets
Draggable from the right-side palette in edit mode. Non-multi presets (Backstory, Relationships, Arc Notes, Quotes, Personality, Powers, Inventory, Goals, Fears, Secrets) can only be placed once per character — enforced both client-side (palette greys out placed presets) and server-side (`create_card_block` rejects duplicates by `(character_id, title)` when the drag flagged the preset as non-multi). Label and Text are multi-instance generic presets.

### Block model
Each block in the grid is a named module with rich text content:

`character_card_blocks` table:
- id
- character_id
- title (e.g. "Relationships", "Powers", "Secrets")
- content (rich text JSON — TipTap format)
- grid_column integer — starting column (1–3)
- grid_row integer — starting row
- col_span integer default 1 — width in columns (1–3)
- row_span integer default 1 — height in rows (1–2)
- sort_order integer — fallback ordering
- created_at
- updated_at

### Card edit mode
In edit mode, a **dock/palette** appears on the right side of the screen (like Photoshop's tool panel). It contains:
- preset block types: Relationships, Personality, Arc Notes, Powers, Secrets, Backstory, Quotes, Inventory, Goals, Fears
- a **"+ Custom"** button to create a user-named block type
- the user **drags a block from the dock** onto the grid to place it (default size: 1×1)
- blocks snap to the nearest available grid cell. If no space is available, the drag is rejected with a visual indicator
- after placement, the user can:
  - click the block to select it (blue highlight border)
  - resize it (cycle width 1→2→3 columns, cycle height 1→2 rows) via size buttons on the selected block
  - drag it to reposition within the grid (other blocks do not auto-rearrange)
  - delete it via a delete button on the block header
  - edit the content inside (rich text editor with inline `[[links]]` support)

### Card view mode
In view mode:
- all edit UI disappears (dock, drag handles, resize buttons, delete buttons)
- block content renders as styled HTML (headings, bullet lists, `[[links]]` as clickable references)
- the grid layout stays exactly the same as in edit mode
- the card is read-only

### Linked records — on Details only
In V1 the Linked Records section is rendered only on the Details page, not on the card. This avoids competing with the card's fixed-viewport grid layout (Linked Records would anchor awkwardly below a sparse grid). The Details layout gives it full width and a collapsible accordion.

## 6. Character Details Page (back)

### Purpose
The details page is the "character bible." It contains deeper material about who this character is — not their story journey (that's Lore Archive), but the foundational material that defines them.

### Flip transition
A toggle button on the card triggers a **3D card flip animation** (CSS 3D transform, `rotateY`, 400ms duration) to reveal the details page. The flip works both ways — the user can click the toggle to flip back at any time. If clicked mid-animation, the flip reverses. The card always loads in the non-flipped (card front) state.

### Structure — Horizontally navigated tabbed panels
The details page uses a **horizontal panel system**:
- tabs along the top name each section
- clicking a tab slides the panel view left or right to that section
- arrow keys or prev/next buttons also navigate between panels
- navigation dots indicate current position

Each panel is a full section that fills the available width. Panels scroll vertically if content exceeds the visible area.

### First section (always present — "Overview")
The first tab/panel is always present and cannot be removed or renamed. Its title is "Overview." Its layout type is fixed to key-value grid + prose. Position is always first; cannot be reordered.

Contents:
- image (same asset as card image, displayed smaller)
- name
- core stats/details as a key-value grid (the same brief_details_json from the card, optionally extended)
- objective summary — factual rich text paragraph about who the character is

Content is editable in edit mode but the section structure cannot be changed.

### User-customizable sections
Beyond the first section, the user creates their own tabs/sections. Each section has:
- a **title** (user-named, e.g. "Background," "Relationships," "Opinions," "FYIs")
- a **layout type** that determines how content is structured inside

`character_detail_sections` table:
- id
- character_id
- title
- layout_type (e.g. 'prose', 'grid', 'timeline', 'cards')
- content (rich text JSON — used for prose/markdown layouts)
- structured_content_json nullable (JSON — used for grid/cards/timeline layouts)
- sort_order integer — determines tab ordering
- created_at
- updated_at

### Section layout types
Each section has its own structured layout. Available types:

**Prose** — longform rich text (TipTap editor). Two-column layout for content longer than 500 characters, single column otherwise. Supports inline `[[links]]`, headings, bold, italic, bullet lists. Suitable for: Background, History, Philosophy, FYIs.

**Cards** — a 3-column grid of small cards. Each card has:
- title (plain text, required)
- subtitle/type label (plain text, optional — e.g., "Ally · Reluctant")
- description (rich text, supports inline `[[links]]`)
- optional link to another character or entity (via entity_links)

Cards can be added, edited, removed, and reordered. Suitable for: Relationships, Affiliations, Allies, Enemies.

**Timeline** — a vertical list of entries, each with:
- date/label (plain text, optional — e.g., "Year 1361" or "Act 2")
- title (plain text, required)
- description (rich text)

Entries are displayed in the order the user arranges them (manual ordering via drag-and-drop). Suitable for: Story Arc, Key Events, History.

**Key-Value Grid** — a 2- or 3-column grid of label + value pairs:
- label (plain text, left column)
- value (plain text or short rich text, right column)

Rows can be added, removed, and reordered. Suitable for: Overview stats, Abilities, Attributes.

The user selects the layout type when creating a section, and may convert it later via a **Convert layout** action on the section (edit mode only; Overview is excluded). Conversion preserves content where the shapes map cleanly (e.g. Cards ↔ Timeline carries title + description; Timeline → Cards puts date into subtitle; any structured layout → Prose joins entries into paragraphs). When fields cannot map (Cards subtitles → Timeline/KV, or any Prose → structured conversion), the confirm dialog surfaces the dropped content as a copyable plaintext dump so the user can paste it elsewhere before committing. The one-shot dump with clipboard copy is the agreed safety net — there is no undo stack.

### Details edit mode
In edit mode:
- tabs can be added, renamed, reordered, or deleted
- a tab's layout type can be converted in place via the section's **Convert layout** action (see Section layout types above)
- panel content is editable using the appropriate editor for the layout type
- for prose layout: rich text editor
- for cards layout: add/edit/remove/reorder card entries (drag handle on hover)
- for timeline layout: add/edit/remove/reorder timeline entries
- for key-value layout: add/edit/remove/reorder rows

### Details view mode
In view mode:
- edit UI disappears
- content renders in its styled format
- tabs are still navigable
- the page is read-only

## 7. Character list view
The character list in Character Codex shows characters as **thumbnail cards**.

Each card shows:
- character image thumbnail
- character name
- optionally: decorative ribbon/accent

The user may also style cards with transparent backgrounds so the character image appears embedded in the page (creative option).

### List behavior
- card grid layout
- search by name
- **manual reordering** via drag-and-drop (edit mode + Manual sort + no search/tag filter active; visible `⋮⋮` handle on hover)
- sort modes: Manual, Name (A–Z), Recently edited, Newest first
- multi-tag filter with AND semantics
- multi-select (shift / ctrl-click) for bulk delete + bulk add-tag
- **Recycle Bin** toolbar button opens an in-place subview listing soft-deleted characters with Restore + Delete-permanently actions; items auto-purge after 24h
- clicking a card opens the Character Card Page

## 8. Linked records
Characters can link to:
- other characters
- map entities
- lore documents

Links appear:
- as a dedicated accordion section on the Details Page (grouped by target type — Characters / Locations / Lore)
- through inline `[[links]]` in any rich text content (card blocks, detail sections) — triggered by typing `[[`, which opens an autocomplete list of linkable entities (self excluded)

Linking uses the shared `entity_links` model (see Packet 6). The Link Picker dialog shows an "Already linked" badge on rows matching existing links for the current source.

## 9. Ribbon / accent behavior
The ribbon is:
- optional
- decorative
- not a logic driver
- not a hidden faction system

It may represent personal meaning for the user. The app must not depend on it semantically.

## 10. Image handling
Character images are imported as assets and linked through `image_asset_id`.

Do not build:
- built-in art tools
- sprite editing
- animation systems

## 11. Scope warnings
Do not let Character Codex turn into:
- a fully freeform page builder with no constraints
- a design toy that prioritizes visual arrangement over content
- a replacement for Lore Archive's narrative writing

The strength of Character Codex is the balance between creative expression (grid layout, custom sections, multiple layout types) and consistent structure (named blocks, typed sections, fixed card dimensions).

## 12. Acceptance criteria
Character Codex is acceptable when the user can:
- create a character with image and name
- see the character card page in the preview-style layout with grid blocks in the inventory arrangement
- add, resize, reposition, and remove grid blocks on the card
- drag blocks from the dock/palette onto the grid; non-multi presets can only be placed once
- flip the card to reveal the details page (3D flip animation)
- see the details page with horizontally navigated tabbed panels
- the first details section is always present with core info
- add custom detail sections with different layout types (prose, cards, timeline, key-value)
- navigate between detail sections via tabs, arrows, or prev/next buttons
- toggle between edit and view modes on both card and details
- view mode renders content as styled HTML with clickable `[[links]]`
- trigger the `[[` autocomplete inside any character rich-text field to insert an inline link
- toggle the cinematic preview view and/or lock it as the default front for a character
- link the character to other characters, map entities, and lore documents
- reorder characters in the list via drag-and-drop
- convert a detail section's layout type after creation; any content that cannot map across appears in a copyable plaintext dump in the confirm dialog
- reorder entries within a Cards, Timeline, or Key-Value section via drag-and-drop in edit mode
- soft-delete a character, find it in the Characters-tab Recycle Bin, and either Restore (full data intact, including grid blocks, sections, links) or Delete permanently (which invalidates inline links pointing at it)
- reopen the app and find all character data preserved (grid layout, block content, detail sections, links)
