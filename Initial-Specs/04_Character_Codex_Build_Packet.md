# Packet 4 — Character Codex Build Packet

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
- **Card**: image, name, brief details, in-character introduction, grid blocks (traits, powers, quick facts, etc.)
- **Details**: background, how relationships formed, affiliations with context, opinions on other characters, FYIs, deeper structured content
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
- character image
- in-character intro (on the card)
- objective summary (on the card or details overview)
- linked records section
- decorative ribbon/accent
- view/edit mode toggle

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
- short_role nullable (plain text)
- objective_summary nullable (rich text JSON)
- in_character_intro nullable (rich text JSON)
- decorative_ribbon nullable
- traits_text nullable
- card_layout_variant text default 'landscape' — either 'landscape' or 'portrait'
- brief_details_json nullable — JSON array of key-value pairs (e.g. `[{"key": "Title", "value": "Fleet Commander"}]`)
- sort_order integer nullable — for manual ordering in the character list
- created_at
- updated_at
- deleted_at nullable — for recycle bin soft-delete

## 5. Character Card Page (front)

### Purpose
The card is the "first impression." It fits on one screen without scrolling. The user sees everything at a glance.

### Layout
The card takes up **80% of the world shell width** with symmetric side margins. On screens narrower than 1024px, card scales to 90%. The remaining margin space has a transparent background.

### Header section
Always present at the top of the card:
- **Image** (required) — rectangular photo slot
- **Name** (required) — in a colored banner
- **Ribbon/accent** — optional decorative color stripe. User selects from a 12-color swatch picker or enters a custom hex color (#RRGGBB). Stored as a nullable hex string. Purely decorative — not used for filtering, searching, or logic.
- **Brief details** (optional) — key-value pairs (Title: Fleet Commander, Born: Year 412, Status: Active)
- **In-character introduction** — a fixed area between the header and the grid. Always visible, cannot be removed. Content is edited in a dedicated rich text field. Visually distinct from factual content (e.g., italic styling, different background tint).

### Two layout variants for the header (user chooses per character)
- **Landscape (default):** left column (40% width) = tall portrait image. Right column (60%) = name, ribbon, brief details.
- **Portrait (alternate):** top = wide landscape image (100% width, 4:5 aspect ratio). Below = name, ribbon, brief details.

Layout variant is selectable during character creation and changeable anytime via edit. Changing variant re-renders the header without affecting the grid below. The grid layout is identical for both variants (always 3 columns, 5 rows).

### Content area — Inventory grid
Below the header + intro, the content area uses a **CSS Grid layout**.

Grid rules:
- fixed at **3 columns** and **5 rows** — this is the maximum grid capacity
- the grid does NOT scroll — it fits within the card viewport
- total grid height is calculated to fill remaining card space after header and intro
- blocks snap to grid cells
- a block can span **1–3 columns** and **1–2 rows**
- blocks must not overlap — the UI prevents placement in occupied cells with a visual indicator (red highlight on unavailable cells)
- if a block's col_span would exceed remaining columns in a row, the drag is rejected
- grid cells may be left intentionally empty for visual breathing room
- block content that exceeds the block's visible height scrolls internally within the block

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

### Linked records on card
Displayed as a read-only section **below the grid** (does not count toward the 5-row grid limit). Shows linked characters, map entities, and lore documents with their link type labels. Links are managed via a link picker dialog, not edited inline on the card. This section is always visible if any links exist; hidden if no links.

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

The user selects the layout type when creating a section. They may change it later (content is preserved where possible; incompatible content may be lost with a warning).

### Details edit mode
In edit mode:
- tabs can be added, renamed, reordered, or deleted
- panel content is editable using the appropriate editor for the layout type
- for prose layout: rich text editor
- for cards layout: add/edit/remove card entries
- for timeline layout: add/edit/remove timeline entries
- for key-value layout: add/edit/remove rows

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
- **manual reordering** via drag-and-drop
- default sort on first load: **alphabetical by name**
- optional filtering by tags
- clicking a card opens the Character Card Page

## 8. Linked records
Characters can link to:
- map entities
- lore documents

Links appear:
- as a dedicated section on the Card Page (a grid block, or a fixed area)
- within Details Page sections where relevant
- through inline `[[links]]` in any rich text content

Linking uses the shared `entity_links` model (see Packet 6).

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
- see the character card page with grid blocks in the inventory layout
- add, resize, reposition, and remove grid blocks on the card
- drag blocks from the dock/palette onto the grid
- flip the card to reveal the details page (3D flip animation)
- see the details page with horizontally navigated tabbed panels
- the first details section is always present with core info
- add custom detail sections with different layout types (prose, cards, timeline, key-value)
- navigate between detail sections via tabs, arrows, or prev/next buttons
- toggle between edit and view modes on both card and details
- view mode renders content as styled HTML with clickable `[[links]]`
- link the character to map entities and lore docs
- reorder characters in the list via drag-and-drop
- reopen the app and find all character data preserved (grid layout, block content, detail sections, links)
